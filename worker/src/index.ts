/**
 * Hadees Vijnanakosham — AI worker (Cloudflare Workers, free tier).
 *
 *   POST /search/semantic  { q, vol?, k? }              -> { results }
 *   POST /ask              { q, vol?, history? }        -> { answer, sources, provider }
 *   POST /admin/embed      { limit? }  (x-admin-token)  -> { embedded, remaining }
 *   GET  /health
 *   cron daily: pings Supabase so the free project is never paused
 *
 * Embeddings: Workers AI @cf/baai/bge-m3 (multilingual, 1024 dims) stored in Supabase pgvector.
 * Answers: Claude when ANTHROPIC_API_KEY is set, otherwise a free Workers AI model.
 */
import Anthropic from '@anthropic-ai/sdk';

export interface Env {
  AI: Ai;
  CACHE: KVNamespace;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_KEY?: string; // only needed for /admin/embed
  ADMIN_TOKEN?: string;
  ANTHROPIC_API_KEY?: string;
  CLAUDE_MODEL?: string;
  WORKERS_AI_MODEL?: string;
  ALLOWED_ORIGINS?: string; // comma separated, '*' default
}

const EMBED_MODEL = '@cf/baai/bge-m3';
// free, no license click-through (gemma needs one), good Malayalam, cheap MoE
const DEFAULT_WORKERS_LLM = '@cf/qwen/qwen3-30b-a3b-fp8';

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

async function rpc<T>(env: Env, fn: string, body: unknown, key = env.SUPABASE_ANON_KEY): Promise<T> {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`supabase ${fn}: ${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

async function embed(env: Env, texts: string[]): Promise<number[][]> {
  const out = (await env.AI.run(EMBED_MODEL, { text: texts })) as { data: number[][] };
  return out.data;
}

async function sha256(t: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const vec = (v: number[]) => `[${v.join(',')}]`;

async function semantic(env: Env, q: string, vol: number | null, k: number): Promise<Hit[]> {
  const [v] = await embed(env, [q]);
  return rpc<Hit[]>(env, 'match_hadiths', { query_embedding: vec(v), k, vol, min_sim: 0.35 });
}

async function keyword(env: Env, q: string, vol: number | null, lim: number): Promise<Hit[]> {
  return rpc<Hit[]>(env, 'app_search', { q, vol, book: null, src: null, lim, off: 0 });
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
- Be concise.`;

function contextBlock(hits: Hit[]): string {
  return hits
    .map((h, i) => {
      const where = `വാല്യം ${h.volume_id} · ${h.book_title_ml}${h.chapter_title_ml ? ' › ബാബ് ' + (h.chapter_no ?? '') + ': ' + h.chapter_title_ml : ''} · ഹദീസ് ${h.hadith_label ?? h.hadith_no}`;
      const src = h.source_codes_ml?.length ? ` (${h.source_codes_ml.join(', ')})` : '';
      return `[${i + 1}] ${where}${src}\nനിവേദകൻ: ${h.narrator_ml ?? '-'}\n${h.malayalam_text.slice(0, 1800)}`;
    })
    .join('\n\n');
}

type Turn = { role: 'user' | 'assistant'; content: string };

async function answerClaude(env: Env, q: string, hits: Hit[], history: Turn[]): Promise<string> {
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
      { role: 'user', content: `Passages:\n\n${contextBlock(hits)}\n\nQuestion: ${q}` },
    ],
  });
  if (res.stop_reason === 'refusal') return 'ക്ഷമിക്കണം, ഈ ചോദ്യത്തിന് മറുപടി നൽകാൻ കഴിഞ്ഞില്ല.';
  return res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim();
}

async function answerWorkersAI(env: Env, q: string, hits: Hit[], history: Turn[], model?: string): Promise<string> {
  const out = (await env.AI.run((model || env.WORKERS_AI_MODEL || DEFAULT_WORKERS_LLM) as keyof AiModels, {
    messages: [
      { role: 'system', content: SYSTEM },
      ...history.slice(-4),
      { role: 'user', content: `Passages:\n\n${contextBlock(hits)}\n\nQuestion: ${q}` },
    ],
    max_tokens: 1500,
  } as never)) as { response?: string };
  const o = out as { response?: string; choices?: { message?: { content?: string } }[] };
  return (o.response ?? o.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// ───────── admin: backfill embeddings ─────────
async function adminEmbed(env: Env, limit: number) {
  if (!env.SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY not set');
  const key = env.SUPABASE_SERVICE_KEY;
  const todo = await rpc<{ id: number; text: string }[]>(env, 'hadiths_to_embed', { lim: limit }, key);
  for (let i = 0; i < todo.length; i += 20) {
    const batch = todo.slice(i, i + 20);
    const vecs = await embed(env, batch.map((t) => t.text));
    const rows = batch.map((t, j) => ({ hadith_id: t.id, model: EMBED_MODEL, embedding: vec(vecs[j]) }));
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/hadith_embeddings`, {
      method: 'POST',
      headers: {
        apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json',
        prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    });
    if (!r.ok) throw new Error(`upsert: ${r.status} ${await r.text()}`);
  }
  const [{ remaining }] = await rpc<{ remaining: number }[]>(env, 'embeddings_remaining', {}, key);
  return { embedded: todo.length, remaining };
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
        const cacheKey = history.length ? null : 'ask2:' + (await sha256(`${vol ?? ''}|${q.toLowerCase().replace(/\s+/g, ' ')}`));
        if (cacheKey) {
          const hit = await env.CACHE.get(cacheKey, 'json');
          if (hit) return json({ ...(hit as object), cached: true }, 200, h);
        }
        const hits = await retrieve(env, q, vol, 8);
        if (!hits.length) {
          return json({ answer: 'ഈ ചോദ്യവുമായി ബന്ധപ്പെട്ട ഹദീസുകൾ കണ്ടെത്താനായില്ല. മറ്റൊരു വാക്ക് ഉപയോഗിച്ച് ശ്രമിക്കൂ.', sources: [], provider: null }, 200, h);
        }
        const useClaude = !!env.ANTHROPIC_API_KEY;
        let answer: string;
        try {
          const adminModel = req.headers.get('x-admin-token') && req.headers.get('x-admin-token') === env.ADMIN_TOKEN ? String(body.model ?? '') : '';
          answer = useClaude ? await answerClaude(env, q, hits, history) : await answerWorkersAI(env, q, hits, history, adminModel || undefined);
        } catch (e) {
          // free daily Workers AI allowance used up (or model error): still return the matching hadith
          console.error('answer failed', e);
          return json({
            answer: 'ഇന്നത്തെ സൗജന്യ AI പരിധി കഴിഞ്ഞു. ചോദ്യത്തോട് ഏറ്റവും അടുത്ത ഹദീസുകൾ താഴെ കൊടുക്കുന്നു; AI ഉത്തരം നാളെ വീണ്ടും ലഭിക്കും.',
            sources: hits, provider: null, limited: true,
          }, 200, h);
        }
        const out = { answer, sources: hits, provider: useClaude ? 'claude' : 'workers-ai' };
        if (cacheKey && answer) await env.CACHE.put(cacheKey, JSON.stringify(out), { expirationTtl: 60 * 60 * 24 * 30 });
        return json(out, 200, h);
      }

      if (pathname === '/feedback') {
        const kind = String(body.kind ?? '');
        const message = String(body.message ?? '').trim();
        const contact = String(body.contact ?? '').trim().slice(0, 200) || null;
        if (!['idea', 'problem', 'text', 'praise'].includes(kind) || message.length < 3) return json({ error: 'Please write a few words.' }, 400, h);
        // light spam guard: 5 messages per hour per IP
        const ip = req.headers.get('cf-connecting-ip') ?? 'anon';
        const key = `rl:fb:${ip}:${Math.floor(Date.now() / 3_600_000)}`;
        const used = Number((await env.CACHE.get(key)) ?? 0);
        if (used >= 5) return json({ error: 'Too many messages — please try again later.' }, 429, h);
        await env.CACHE.put(key, String(used + 1), { expirationTtl: 3700 });
        const r = await fetch(`${env.SUPABASE_URL}/rest/v1/feedback`, {
          method: 'POST',
          headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${env.SUPABASE_ANON_KEY}`, 'content-type': 'application/json', prefer: 'return=minimal' },
          body: JSON.stringify({
            kind, message: message.slice(0, 2000), contact,
            hadith_id: Number.isInteger(body.hadith_id) ? body.hadith_id : null,
            page: String(body.page ?? '').slice(0, 80) || null,
            platform: String(body.platform ?? '').slice(0, 20) || null,
          }),
        });
        if (!r.ok) throw new Error(`feedback insert: ${r.status} ${await r.text()}`);
        return json({ ok: true }, 200, h);
      }

      if (pathname === '/admin/embed') {
        if (!env.ADMIN_TOKEN || req.headers.get('x-admin-token') !== env.ADMIN_TOKEN) return json({ error: 'forbidden' }, 403, h);
        return json(await adminEmbed(env, Math.min(Number(body.limit ?? 200), 400)), 200, h);
      }

      return json({ error: 'not found' }, 404, h);
    } catch (e) {
      console.error(e);
      return json({ error: e instanceof Error ? e.message : 'error' }, 500, h);
    }
  },

  // Daily cron (wrangler.toml [triggers]): a real query keeps the free Supabase project from being paused for inactivity.
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/hadiths?select=id&limit=1`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${env.SUPABASE_ANON_KEY}` },
    });
    await env.CACHE.put('keepalive:last', JSON.stringify({ at: new Date().toISOString(), status: r.status }));
    if (!r.ok) console.error('keepalive failed', r.status);
  },
} satisfies ExportedHandler<Env>;
