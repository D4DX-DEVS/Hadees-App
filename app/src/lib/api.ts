import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { expandQuery } from './synonyms';
import { packBookHadiths, packChapterHadiths, packChapters, packHadith, recall, remember } from './offline';
import type {
  Narrator,
  Article, ArticleBlock, Book, Suggestion, Chapter, CrossRef, Hadith, Source, TitleHit, Variant, Volume,
} from './types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const AI_URL = (process.env.EXPO_PUBLIC_AI_URL ?? '').replace(/\/$/, '');

export const configured = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// Read-only public client; no user session is kept (all personal data stays on the device).
// One client per page: web hot reloads re-run this module, so the instance is kept on globalThis.
const g = globalThis as { __hvSupabase?: SupabaseClient };
export const supabase: SupabaseClient =
  g.__hvSupabase ??
  (g.__hvSupabase = createClient(SUPABASE_URL || 'http://localhost', SUPABASE_ANON_KEY || 'missing', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'hv-public' },
    // development: name any failing database request in the console
    global: {
      fetch: async (input, init) => {
        const r = await fetch(input, init);
        if (!r.ok && typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[supabase]', r.status, String(input).slice(0, 180));
        return r;
      },
    },
  }));

/** Retry once when the database cancels a slow query (it happens on a cold start). */
async function retry<T>(fn: () => PromiseLike<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Error && /statement timeout|fetch failed|Failed to fetch/i.test(e.message)) {
      await new Promise((r) => setTimeout(r, 600));
      return fn();
    }
    throw e;
  }
}

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

// tiny in-memory cache for static lookups (library data never changes during a session)
const cache = new Map<string, Promise<unknown>>();
function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (!cache.has(key)) cache.set(key, fn().catch((e) => { cache.delete(key); throw e; }));
  return cache.get(key) as Promise<T>;
}

/** a static lookup that is mirrored to the device, so the library still opens without a connection */
function lookup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return cached(key, async () => {
    try {
      const v = await fn();
      remember(key, v);
      return v;
    } catch (e) {
      const old = await recall<T>(key);
      if (old) return old;
      throw e;
    }
  });
}

export const api = {
  volumes: () => lookup('volumes', async () => must<Volume[]>(await supabase.from('volumes').select('id,title_ml').order('id'))),

  books: () =>
    lookup('books', async () =>
      must<Book[]>(await supabase.from('book_stats').select('*').order('volume_id').order('book_no')),
    ),

  chapters: (bookId: number) =>
    cached(`chapters:${bookId}`, async () =>
      (await packChapters(bookId)) ??
      must<Chapter[]>(await supabase.from('chapter_stats').select('*').eq('book_id', bookId).order('chapter_no')),
    ),

  chapterHadiths: (chapterId: number) =>
    cached(`ch-h:${chapterId}`, async () =>
      (await packChapterHadiths(chapterId)) ??
      must<Hadith[]>(await supabase.from('hadith_full').select('*').eq('chapter_id', chapterId).order('hadith_no')),
    ),

  bookHadiths: async (bookId: number, from: number, to: number) =>
    (await packBookHadiths(bookId))?.slice(from, to + 1) ??
    must<Hadith[]>(await supabase.from('hadith_full').select('*').eq('book_id', bookId).order('hadith_no').range(from, to)),

  hadith: (id: number) =>
    cached(`h:${id}`, async () => (await packHadith(id)) ?? must<Hadith>(await supabase.from('hadith_full').select('*').eq('id', id).single())),

  /** neighbours inside the same book, by printed number */
  neighbours: async (h: Hadith) => {
    const [prev, next] = await Promise.all([
      supabase.from('hadiths').select('id').eq('book_id', h.book_id).lt('hadith_no', h.hadith_no).order('hadith_no', { ascending: false }).limit(1),
      supabase.from('hadiths').select('id').eq('book_id', h.book_id).gt('hadith_no', h.hadith_no).order('hadith_no').limit(1),
    ]);
    return { prev: prev.data?.[0]?.id as number | undefined, next: next.data?.[0]?.id as number | undefined };
  },

  variants: (hadithId: number) =>
    cached(`v:${hadithId}`, async () =>
      must<Variant[]>(await supabase.from('hadith_variants').select('*').eq('hadith_id', hadithId).order('seq')),
    ),

  crossRefs: (hadithId: number) =>
    cached(`x:${hadithId}`, async () => must<CrossRef[]>(await supabase.rpc('app_cross_refs', { hid: hadithId }))),

  /** number of cross references per hadith id (for badges in lists) */
  refCounts: async (ids: number[]) => {
    const counts: Record<number, number> = {};
    if (!ids.length) return counts;
    const list = ids.join(',');
    const r = await supabase.from('hadith_relations').select('hadith_id,related_id').or(`hadith_id.in.(${list}),related_id.in.(${list})`);
    const set = new Set(ids);
    for (const row of must<{ hadith_id: number; related_id: number }[]>(r)) {
      if (set.has(row.hadith_id)) counts[row.hadith_id] = (counts[row.hadith_id] ?? 0) + 1;
      if (set.has(row.related_id)) counts[row.related_id] = (counts[row.related_id] ?? 0) + 1;
    }
    return counts;
  },

  /** hadith narrator spelling -> narrator id (only narrators that have a biography in the book) */
  narratorMap: () =>
    cached('narratorMap', async () => {
      const rows = must<{ spelling: string; narrator_id: number }[]>(await supabase.from('narrator_spellings').select('spelling,narrator_id'));
      return new Map(rows.map((r) => [r.spelling, r.narrator_id]));
    }),

  /** all printed spellings of the same person as this one (just itself when unknown) */
  narratorSpellings: (name: string) =>
    cached(`ns:${name}`, async () => {
      const g = await supabase.from('narrator_groups').select('gkey').eq('spelling', name).maybeSingle();
      const key = g.data?.gkey as string | undefined;
      if (!key) return [name];
      const r = await supabase.from('narrator_groups').select('spelling').eq('gkey', key);
      return ((r.data ?? []) as { spelling: string }[]).map((x) => x.spelling);
    }),

  /** hadith count for a narrator, all spellings of the name together */
  narratorCount: async (name: string) => {
    const names = await api.narratorSpellings(name);
    const r = await supabase.from('hadiths').select('id', { count: 'exact', head: true }).in('narrator_ml', names);
    if (r.error) throw new Error(r.error.message);
    return r.count ?? 0;
  },

  narratorByName: async (name: string, offset = 0, limit = 30) => {
    const names = await api.narratorSpellings(name);
    const r = await supabase.from('hadith_full').select('*', { count: 'exact' }).in('narrator_ml', names).order('volume_id').order('book_no').order('hadith_no').range(offset, offset + limit - 1);
    if (r.error) throw new Error(r.error.message);
    return { rows: (r.data ?? []) as Hadith[], total: r.count ?? 0 };
  },

  narrator: (id: number) =>
    cached(`narrator:${id}`, async () => must<Narrator>(await supabase.from('narrator_stats').select('*').eq('id', id).single())),

  /** total hadith in the library (for random / daily picks) */
  hadithCount: async () => {
    const r = await supabase.from('hadiths').select('id', { count: 'exact', head: true });
    if (r.error) throw new Error(r.error.message);
    return r.count ?? 0;
  },
  /** the hadith at position n (0-based) in id order */
  hadithAt: async (n: number) => must<Hadith[]>(await supabase.from('hadith_full').select('*').order('id').range(n, n))[0] ?? null,
  /** one hadith by book and printed number */
  hadithByNumber: async (bookId: number, no: number) =>
    must<Hadith[]>(await supabase.from('hadith_full').select('*').eq('book_id', bookId).eq('hadith_no', no).limit(1)),
  /** today's hadith: the same for everyone on a given day */
  dailyHadith: async () => {
    const n = await api.hadithCount();
    if (!n) return null;
    const day = Math.floor(Date.now() / 86400000);
    return api.hadithAt((day * 7919) % n);
  },
  narratorHadiths: async (id: number, offset = 0, limit = 30) =>
    must<Hadith[]>(await supabase.rpc('narrator_hadiths', { nid: id, lim: limit, off: offset })),

  sources: () => lookup('sources', async () => must<Source[]>(await supabase.from('sources').select('*'))),

  search: async (
    q: string,
    opts: { vol?: number | null; book?: number | null; src?: string | null; limit?: number; offset?: number; sort?: 'relevance' | 'book'; narr?: string[]; ngroup?: string | null } = {},
  ) => {
    const ex = expandQuery(q);
    return retry(async () =>
      must<Hadith[]>(
        await supabase.rpc('app_search', {
          q, vol: opts.vol ?? null, book: opts.book ?? null, src: opts.src ?? null,
          lim: opts.limit ?? 30, off: opts.offset ?? 0,
          sort: opts.sort ?? 'relevance', terms: ex.terms, narr: [...ex.narrators, ...(opts.narr ?? [])], ngroup: opts.ngroup ?? null,
        }),
      ),
    );
  },

  /** suggestions while typing: narrators, chapters, books */
  suggest: async (q: string) => must<Suggestion[]>(await supabase.rpc('app_suggest', { q, lim: 8 })),

  searchTitles: async (q: string) => must<TitleHit[]>(await supabase.rpc('app_search_titles', { q, lim: 8 })),

  hadithOfDay: () =>
    cached('hod', async () => must<Hadith[]>(await supabase.rpc('hadith_of_day'))[0] ?? null),

  /** the hadith of a given day (same pick for everyone on that date) */
  hadithOn: async (d: Date) => {
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return must<Hadith[]>(await supabase.rpc('hadith_of_day', { d: day }))[0] ?? null;
  },

  articles: () =>
    lookup('articles', async () =>
      must<Article[]>(await supabase.from('articles').select('*').order('volume_id').order('section_no')),
    ),

  article: (id: number) =>
    cached(`a:${id}`, async () => {
      const [a, b] = await Promise.all([
        supabase.from('articles').select('*').eq('id', id).single(),
        supabase.from('article_blocks').select('*').eq('article_id', id).order('seq'),
      ]);
      return { article: must<Article>(a), blocks: must<ArticleBlock[]>(b) };
    }),
};

// ───────── AI worker ─────────
export type AskResult = { answer: string; sources: Hadith[]; provider: string | null };

export const ai = {
  enabled: !!AI_URL,
  async ask(q: string, history: { role: 'user' | 'assistant'; content: string }[], vol?: number | null): Promise<AskResult> {
    const r = await fetch(`${AI_URL}/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q, history, vol: vol ?? null }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error ?? `AI error ${r.status}`);
    return data;
  },
  async semantic(q: string, vol?: number | null): Promise<Hadith[]> {
    const r = await fetch(`${AI_URL}/search/semantic`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q, vol: vol ?? null, k: 20 }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error ?? `AI error ${r.status}`);
    return data.results;
  },
};
