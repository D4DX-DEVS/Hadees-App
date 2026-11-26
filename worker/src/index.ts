/**
 * Hadees Vijnanakosham — AI worker (Cloudflare Workers, free tier).
 *
 *   POST /search/semantic  { q, vol?, k? }              -> { results }
 *   POST /ask              { q, vol?, history? }        -> { answer, sources, provider }
 *   GET  /health
 *
 * Embeddings: Workers AI @cf/baai/bge-m3 (multilingual, 1024 dims), stored in pgvector on the cPanel server.
 * The library database is reached ONLY through the PHP API (API_URL): route `search` (keyword) and `match`
 * (vector search, needs MATCH_KEY). Feedback goes from the app straight to the PHP API.
 * Answers: Claude when ANTHROPIC_API_KEY is set, otherwise a free Workers AI model.
 */
import Anthropic from '@anthropic-ai/sdk';

export interface Env {
  AI: Ai;
  CACHE: KVNamespace;
  API_URL: string;     // https://hadithencyclopedia.com/api/index.php
  MATCH_KEY: string;   // secret: same value as 'match_key' in /home/<account>/hadees-config.php
  ADMIN_TOKEN?: string;
  ANTHROPIC_API_KEY?: string;
  CLAUDE_MODEL?: string;
  WORKERS_AI_MODEL?: string;
  ALLOWED_ORIGINS?: string; // comma separated, '*' default
}

const EMBED_MODEL = '@cf/baai/bge-m3';
// free tier, good Malayalam. (@cf/qwen/qwen3-30b-a3b-fp8 was retired by Cloudflare on 2026-11-20; override with the WORKERS_AI_MODEL variable if this one is retired too)
const DEFAULT_WORKERS_LLM = '@cf/google/gemma-4-26b-a4b-it';

type Hit = {
  id: number; book_id: number; hadith_no: number; hadith_label: string | null;
  arabic_text: string; malayalam_text: string; narrator_ml: string | null; source_codes_ml: string[] | null;
  volume_id: number; book_no: number; book_title_ml: string; chapter_no: number | null; chapter_title_ml: string | null;
  similarity?: number; rank?: number;
};

// ───────── helpers ─────────
function cors(env: Env, req: Request): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS ?? '*').split(',').map((s) => s.trim());
  const origin = req.headers.get('origin') ?? '';
  const allow = allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : allowed[0];
  return {
    'access-control-allow-origin': allow,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-admin-token',
    'access-control-max-age': '86400',
  };
}

function json(data: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

/** POST one route of the PHP API (https://.../api/index.php?r=<route>) and return its JSON. */
async function callApi<T>(env: Env, route: string, body: unknown, headers: Record<string, string> = {}): Promise<T> {
  const url = `${env.API_URL}${env.API_URL.includes('?') ? '&' : '?'}r=${route}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`api ${route}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json() as Promise<T>;
}

/** Library data version (raised by every save in the editor admin page). Part of the answer cache key, so an edit
 * makes every cached answer fresh. Kept 5 minutes per worker instance; on an API error the last value is used. */
let dataVer = { v: '0', at: 0 };
async function dataVersion(env: Env): Promise<string> {
  if (Date.now() - dataVer.at < 5 * 60_000) return dataVer.v;
  try {
    const url = `${env.API_URL}${env.API_URL.includes('?') ? '&' : '?'}r=data_version`;
    const r = await fetch(url);
    const j = (await r.json()) as { v?: number };
    dataVer = { v: String(j.v ?? dataVer.v), at: Date.now() };
  } catch (e) {
    console.error('data_version failed', e instanceof Error ? e.message : e);
    dataVer = { ...dataVer, at: Date.now() - 4 * 60_000 };      // try again in a minute
  }
  return dataVer.v;
}

async function embed(env: Env, texts: string[]): Promise<number[][]> {
  const out = (await env.AI.run(EMBED_MODEL, { text: texts })) as { data: number[][] };
  return out.data;
}

async function sha256(t: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function semantic(env: Env, q: string, vol: number | null, k: number): Promise<Hit[]> {
  const [v] = await embed(env, [q]);
  return callApi<Hit[]>(env, 'match', { embedding: v, k, vol, min_sim: 0.35 }, { 'x-api-key': env.MATCH_KEY });
}

async function keyword(env: Env, q: string, vol: number | null, lim: number): Promise<Hit[]> {
  return callApi<Hit[]>(env, 'search', { q, vol, book: null, src: null, lim, off: 0 });
}

// ───────── extra library: Sunnah.com English passages (schema `sunnah`, API route src_search) ─────────
type ApiExtra = {
  urn: string; collection: string; collection_name: string; reference: string | null; hadith_number: string | null;
  grade_en: string | null; ihadis_grade: string | null; narrator_en: string | null;
  text_en: string; text_ar: string | null; url: string | null;
};
/** What the app gets: a ready label, the English text and the Arabic text. Cited as [n] after the encyclopedia passages. */
type Extra = { label: string; collection: string; grade: string | null; narrator: string | null; text_en: string; text_ar: string | null; url: string | null };
const MAX_EXTRA = 4;
// grades that must never reach the model: the answer would present them as hadith
const REJECTED_GRADE = /fabricat|mawdu|maudu|munkar|batil|forged|baseless/i;
const WEAK_GRADE = /da['’`]?if|weak/i;

/** English search words for a question. A question written in English is used as it is; Malayalam (or any other script) is turned into keywords by the model, cached for 30 days. */
async function englishKeywords(env: Env, q: string): Promise<string> {
  const letters = q.replace(/[\s\d\p{P}]/gu, '');
  if (!letters) return '';
  // a short question in English is already a keyword list; a longer one ("what is the reward for feeding a hungry person") is reduced to its key words
  if ((letters.match(/[A-Za-z]/g) ?? []).length >= letters.length * 0.6 && q.trim().split(/\s+/).length <= 4) return q;
  const key = 'kw2:' + (await sha256(q.toLowerCase().replace(/\s+/g, ' ')));
  const cached = await env.CACHE.get(key);
  if (cached !== null) return cached;
  const out = (await env.AI.run((env.WORKERS_AI_MODEL || DEFAULT_WORKERS_LLM) as keyof AiModels, {
    messages: [
      {
        role: 'system',
        content: 'You turn a question about Islam, written in any language, into English search keywords for a database of English hadith translations. Reply with ONLY 3 to 5 lowercase English words separated by spaces, the most important word FIRST, using words that would appear in the hadith text itself (for example: fasting ramadan reward). No punctuation, no explanation.',
      },
      { role: 'user', content: q },
    ],
    max_tokens: 60,
    chat_template_kwargs: { enable_thinking: false },
  } as never)) as { response?: string; choices?: { message?: { content?: string } }[] };
  const text = (out.response ?? out.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '');
  const kw = (text.match(/[A-Za-z]{3,}/g) ?? []).slice(0, 8).join(' ').toLowerCase();
  if (kw) await env.CACHE.put(key, kw, { expirationTtl: 60 * 60 * 24 * 30 });
  return kw;
}

/** Sunnah.com passages for a question: by meaning (the question embedding against the embedded English library, works for Malayalam questions directly);
 *  if that is not available or finds nothing, by English keywords (the question is reduced to keywords by the model first). */
async function extraSources(env: Env, q: string): Promise<{ kw: string; items: Extra[] }> {
  let rows: ApiExtra[] = [];
  let kw = '';
  try {
    const [v] = await embed(env, [q]);
    rows = await callApi<ApiExtra[]>(env, 'src_match', { embedding: v, k: MAX_EXTRA + 4, min_sim: 0.5 }, { 'x-api-key': env.MATCH_KEY });
    if (rows.length) kw = 'semantic';
  } catch (e) {
    console.error('src_match failed, using keywords', e instanceof Error ? e.message.slice(0, 200) : e);
  }
  if (!rows.length) {
    kw = await englishKeywords(env, q);
    if (!kw) return { kw, items: [] };
    rows = await callApi<ApiExtra[]>(env, 'src_search', { q: kw, src: 'sunnah', lim: MAX_EXTRA + 3, strict: true });
  }
  const items: Extra[] = rows
    .filter((r) => !REJECTED_GRADE.test(`${r.grade_en ?? ''} ${r.ihadis_grade ?? ''}`))
    .slice(0, MAX_EXTRA)
    .map((r) => {
      const ref = r.reference ?? (r.hadith_number ? `Hadith ${r.hadith_number}` : '');
      return {
        label: ref.toLowerCase().includes(r.collection_name.toLowerCase()) ? ref : `${r.collection_name} · ${ref}`,
        collection: r.collection_name,
        grade: r.grade_en ?? r.ihadis_grade,
        narrator: r.narrator_en,
        text_en: r.text_en,
        text_ar: r.text_ar?.trim() || null,
        url: r.url,
      };
    });
  return { kw, items };
}

/** The model does not reliably say when it cites a weak hadith, so this does it: every line that cites a weak extra passage gets a visible note. */
function flagWeak(answer: string, ownCount: number, extra: Extra[]): string {
  const weak = new Set(extra.flatMap((e, i) => (e.grade && WEAK_GRADE.test(e.grade) ? [ownCount + i + 1] : [])));
  if (!weak.size) return answer;
  return answer
    .split('\n')
    .map((line) => {
      if (/ദുർബല/.test(line)) return line;
      const cited = [...line.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)].flatMap((m) => m[1].split(',').map((n) => parseInt(n.trim(), 10)));
      return cited.some((n) => weak.has(n)) ? `${line.trimEnd()} (ദുർബലമായ ഹദീസ്)` : line;
    })
    .join('\n');
}

/** Hybrid retrieval: semantic hits first, then keyword hits not already present (reciprocal-rank merge). */
async function retrieve(env: Env, q: string, vol: number | null, k: number): Promise<Hit[]> {
  const [sem, kw] = await Promise.all([
    semantic(env, q, vol, k).catch(() => [] as Hit[]),
    q.trim().split(/\s+/).length <= 4 ? keyword(env, q, vol, k).catch(() => [] as Hit[]) : Promise.resolve([] as Hit[]),
  ]);
  const score = new Map<number, { hit: Hit; s: number }>();
  sem.forEach((h, i) => score.set(h.id, { hit: h, s: 1 / (60 + i) }));
  kw.forEach((h, i) => {
    const cur = score.get(h.id);
    if (cur) cur.s += 1 / (60 + i);
    else score.set(h.id, { hit: h, s: 1 / (60 + i) });
  });
  return [...score.values()].sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.hit);
}

const SYSTEM = `You are the study assistant of "ഹദീസ് വിജ്ഞാനകോശം" (Hadees Vijnanakosham), a Malayalam hadith encyclopedia.
Answer ONLY from the numbered hadith passages provided in the user turn. Rules:
- ALWAYS write the answer in Malayalam (Malayalam script), whatever language the question is in. Switch to English only if the user explicitly asks for English. Keep Arabic words, narrator names and book titles exactly as given in the passages.
- Cite every claim with the passage number in square brackets, e.g. [1] or [2][5]. The app shows the full reference (volume, book, chapter, hadith number, source books) for each number, so do not write references out yourself and never invent hadith, numbers, narrators or books.
- If the question is about a topic, give: a short direct answer (2-3 sentences), then the main points as a bulleted list, each point ending with its citation(s).
- If the passages do not answer the question, say so plainly in Malayalam and suggest a better search term. Do not answer from outside knowledge.
- You explain what the hadith say; you do not issue fatwas. For personal religious rulings, advise consulting a qualified scholar.
- Passages marked "(Sunnah.com, English)" are English translations from outside the encyclopedia. You may use them too: translate their meaning faithfully into Malayalam, stay close to their wording, never add details, and cite them with their number like the others. Keep the names of narrators and books in English exactly as written there; never guess a Malayalam spelling for them. If a passage's grade says Da'if, weak, Mawdu' or fabricated, say so plainly in the same bullet (ദുർബലമായ ഹദീസ്) and never present it as authentic; mention Sahih or Hasan grades only briefly. When a point is covered by both, prefer the Malayalam passage.
- Be concise.`;

function contextBlock(hits: Hit[], extra: Extra[] = []): string {
  const own = hits.map((h, i) => {
    const where = `വാല്യം ${h.volume_id} · ${h.book_title_ml}${h.chapter_title_ml ? ' › ബാബ് ' + (h.chapter_no ?? '') + ': ' + h.chapter_title_ml : ''} · ഹദീസ് ${h.hadith_label ?? h.hadith_no}`;
    const src = h.source_codes_ml?.length ? ` (${h.source_codes_ml.join(', ')})` : '';
    return `[${i + 1}] ${where}${src}\nനിവേദകൻ: ${h.narrator_ml ?? '-'}\n${h.malayalam_text.slice(0, 1800)}`;
  });
  const more = extra.map(
    (e, i) => `[${hits.length + i + 1}] (Sunnah.com, English) ${e.label}${e.grade ? ` · Grade: ${e.grade}` : ''}${e.grade && WEAK_GRADE.test(e.grade) ? ' · WEAK HADITH: you must say it is weak (ദുർബലം)' : ''}\nNarrator: ${e.narrator ?? '-'}\n${e.text_en.slice(0, 1200)}`,
  );
  return [...own, ...more].join('\n\n');
}

type Turn = { role: 'user' | 'assistant'; content: string };

async function answerClaude(env: Env, q: string, hits: Hit[], extra: Extra[], history: Turn[]): Promise<string> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const res = await client.beta.messages.create({
    model: env.CLAUDE_MODEL || 'claude-opus-5-5',
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: SYSTEM,
    messages: [
      ...history.slice(-6),
      { role: 'user', content: `Passages:\n\n${contextBlock(hits, extra)}\n\nQuestion: ${q}` },
    ],
  });
  if (res.stop_reason === 'refusal') return 'ക്ഷമിക്കണം, ഈ ചോദ്യത്തിന് മറുപടി നൽകാൻ കഴിഞ്ഞില്ല.';
  return res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim();
}

async function answerWorkersAI(env: Env, q: string, hits: Hit[], extra: Extra[], history: Turn[], model?: string): Promise<string> {
  const out = (await env.AI.run((model || env.WORKERS_AI_MODEL || DEFAULT_WORKERS_LLM) as keyof AiModels, {
    messages: [
      { role: 'system', content: SYSTEM },
      ...history.slice(-4),
      { role: 'user', content: `Passages:\n\n${contextBlock(hits, extra)}\n\nQuestion: ${q}` },
    ],
    max_tokens: 3000,
    // Gemma 4 / Qwen 3.8 'think' first and return an empty answer when the thinking uses up max_tokens: turn thinking off
    chat_template_kwargs: { enable_thinking: false },
  } as never)) as { response?: string };
  const o = out as { response?: string; choices?: { message?: { content?: string } }[] };
  const text = (o.response ?? o.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  if (!text) throw new Error('empty model answer: ' + JSON.stringify(out).slice(0, 1200));
  return text;
}

// ───────── router ─────────
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const h = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { headers: h });
    const { pathname } = new URL(req.url);

    try {
      if (pathname === '/health') return json({ ok: true, llm: env.ANTHROPIC_API_KEY ? 'claude' : 'workers-ai' }, 200, h);
      if (req.method !== 'POST') return json({ error: 'not found' }, 404, h);
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

      // admin only (x-admin-token = ADMIN_TOKEN secret; without that secret the route does not exist): embeddings for a batch of texts,
      // used by scripts/embed_sources.py to embed the English library once. Same model as the questions, so the vectors are comparable.
      if (pathname === '/admin/embed') {
        const tok = req.headers.get('x-admin-token');
        if (!env.ADMIN_TOKEN || tok !== env.ADMIN_TOKEN) return json({ error: 'not found' }, 404, h);
        const texts = (Array.isArray(body.texts) ? body.texts : []).slice(0, 100).map((t) => String(t).slice(0, 2000));
        if (!texts.length) return json({ vectors: [] }, 200, h);
        return json({ vectors: await embed(env, texts) }, 200, h);
      }

      if (pathname === '/search/semantic') {
        const q = String(body.q ?? '').trim();
        if (!q) return json({ results: [] }, 200, h);
        const vol = body.vol ? Number(body.vol) : null;
        const k = Math.min(Number(body.k ?? 20), 50);
        return json({ results: await semantic(env, q.slice(0, 500), vol, k) }, 200, h);
      }

      if (pathname === '/ask') {
        const q = String(body.q ?? '').trim().slice(0, 800);
        if (!q) return json({ error: 'empty question' }, 400, h);
        const vol = body.vol ? Number(body.vol) : null;
        const history = (Array.isArray(body.history) ? body.history : [])
          .filter((t: any) => (t?.role === 'user' || t?.role === 'assistant') && typeof t?.content === 'string')
          .map((t: any) => ({ role: t.role, content: String(t.content).slice(0, 2000) })) as Turn[];
        // identical standalone question -> cached answer (saves free-tier Workers AI neurons)
        // admin only: x-admin-token + body.model picks the Workers AI model for this request and bypasses the answer cache (for model comparisons)
        const adminModel = req.headers.get('x-admin-token') && req.headers.get('x-admin-token') === env.ADMIN_TOKEN ? String(body.model ?? '') : '';
        // body.extra === true: the app can show the Sunnah.com passages (older app versions do not send it and get the answer as before)
        const wantExtra = body.extra === true;
        const cacheKey = history.length || adminModel ? null : 'ask7:' + (await sha256(`${await dataVersion(env)}|${vol ?? ''}|${wantExtra ? 'x' : ''}|${q.toLowerCase().replace(/\s+/g, ' ')}`));
        if (cacheKey) {
          const hit = await env.CACHE.get(cacheKey, 'json');
          if (hit) return json({ ...(hit as object), cached: true }, 200, h);
        }
        // the encyclopedia passages and the extra English passages are searched at the same time; a failure of the extra search never blocks the answer
        const [hits, found] = await Promise.all([
          retrieve(env, q, vol, 8),
          (wantExtra ? extraSources(env, q) : Promise.resolve({ kw: '', items: [] as Extra[] })).catch((e) => { console.error('extra sources failed', e instanceof Error ? e.message.slice(0, 300) : e); return { kw: '', items: [] as Extra[] }; }),
        ]);
        const extra = found.items;
        if (!hits.length && !extra.length) {
          return json({ answer: 'ഈ ചോദ്യവുമായി ബന്ധപ്പെട്ട ഹദീസുകൾ കണ്ടെത്താനായില്ല. മറ്റൊരു വാക്ക് ഉപയോഗിച്ച് ശ്രമിക്കൂ.', sources: [], extra: [], provider: null }, 200, h);
        }
        const useClaude = !!env.ANTHROPIC_API_KEY;
        let answer: string;
        try {
          answer = useClaude ? await answerClaude(env, q, hits, extra, history) : await answerWorkersAI(env, q, hits, extra, history, adminModel || undefined);
        } catch (e) {
          // free daily Workers AI allowance used up (or model error): still return the matching hadith
          console.error('answer failed', e instanceof Error ? e.message.slice(0, 1500) : e);
          return json({
            answer: 'ഇന്നത്തെ സൗജന്യ AI പരിധി കഴിഞ്ഞു. ചോദ്യത്തോട് ഏറ്റവും അടുത്ത ഹദീസുകൾ താഴെ കൊടുക്കുന്നു; AI ഉത്തരം നാളെ വീണ്ടും ലഭിക്കും.',
            sources: hits, extra, provider: null, limited: true,
          }, 200, h);
        }
        answer = flagWeak(answer, hits.length, extra);
        const out = { answer, sources: hits, extra, ...(wantExtra ? { extra_q: found.kw } : {}), provider: useClaude ? 'claude' : 'workers-ai', ...(adminModel ? { model: adminModel } : {}) };
        if (cacheKey && answer) await env.CACHE.put(cacheKey, JSON.stringify(out), { expirationTtl: 60 * 60 * 24 * 30 });
        return json(out, 200, h);
      }

      return json({ error: 'not found' }, 404, h);
    } catch (e) {
      console.error(e);
      return json({ error: e instanceof Error ? e.message : 'error' }, 500, h);
    }
  },
} satisfies ExportedHandler<Env>;
