import { expandQuery } from './synonyms';
import { packBookHadiths, packChapterHadiths, packChapters, packHadith, recall, remember } from './offline';
import type {
  Narrator,
  Article, ArticleBlock, Book, Suggestion, Chapter, CrossRef, Hadith, Source, TitleHit, Variant, Volume,
} from './types';

/** Full URL of the API script, e.g. https://hadithencyclopedia.com/api/index.php */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
export const AI_URL = (process.env.EXPO_PUBLIC_AI_URL ?? '').replace(/\/$/, '');

export const configured = !!API_URL;

type Params = Record<string, string | number | null | undefined>;

/** One request to the library API (GET with query parameters, or POST with a JSON body). */
export async function request<T>(route: string, params: Params = {}, body?: unknown): Promise<T> {
  if (!API_URL) throw new Error('The library server is not configured.');
  const qs = new URLSearchParams({ r: route });
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) qs.set(k, String(v));
  const r = await fetch(`${API_URL}${API_URL.includes('?') ? '&' : '?'}${qs}`, body === undefined ? undefined : {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data: unknown = await r.json().catch(() => null);
  if (!r.ok) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[api]', r.status, route);
    const msg = (data as { error?: string } | null)?.error;
    throw new Error(msg ?? `Server error ${r.status}`);
  }
  return data as T;
}

/** Retry once when the server was busy or the connection dropped (it happens on a cold start). */
async function retry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Error && /timeout|fetch failed|Failed to fetch|Network request failed|server error|Server error 5/i.test(e.message)) {
      await new Promise((r) => setTimeout(r, 600));
      return fn();
    }
    throw e;
  }
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
  volumes: () => lookup('volumes', () => retry(() => request<Volume[]>('volumes'))),

  books: () => lookup('books', () => retry(() => request<Book[]>('books'))),

  chapters: (bookId: number) =>
    cached(`chapters:${bookId}`, async () =>
      (await packChapters(bookId)) ?? retry(() => request<Chapter[]>('chapters', { book: bookId })),
    ),

  chapterHadiths: (chapterId: number) =>
    cached(`ch-h:${chapterId}`, async () =>
      (await packChapterHadiths(chapterId)) ?? retry(() => request<Hadith[]>('chapter_hadiths', { chapter: chapterId })),
    ),

  bookHadiths: async (bookId: number, from: number, to: number) =>
    (await packBookHadiths(bookId))?.slice(from, to + 1) ??
    retry(() => request<Hadith[]>('book_hadiths', { book: bookId, from, to })),

  hadith: (id: number) =>
    cached(`h:${id}`, async () => (await packHadith(id)) ?? retry(() => request<Hadith>('hadith', { id }))),

  /** neighbours inside the same book, by printed number */
  neighbours: async (h: Hadith) => {
    try {
      const r = await request<{ prev: number | null; next: number | null }>('neighbours', { book: h.book_id, no: h.hadith_no });
      return { prev: r.prev ?? undefined, next: r.next ?? undefined };
    } catch {
      return { prev: undefined, next: undefined };
    }
  },

  variants: (hadithId: number) => cached(`v:${hadithId}`, () => retry(() => request<Variant[]>('variants', { hadith: hadithId }))),

  crossRefs: (hadithId: number) => cached(`x:${hadithId}`, () => retry(() => request<CrossRef[]>('cross_refs', { hadith: hadithId }))),

  /** number of cross references per hadith id (for badges in lists) */
  refCounts: async (ids: number[]) => {
    const counts: Record<number, number> = {};
    for (let i = 0; i < ids.length; i += 300) {
      const rows = await request<{ id: number; n: number }[]>('ref_counts', { ids: ids.slice(i, i + 300).join(',') });
      for (const row of rows) counts[row.id] = row.n;
    }
    return counts;
  },

  /** hadith narrator spelling -> narrator id (only narrators that have a biography in the book) */
  narratorMap: () =>
    cached('narratorMap', async () => {
      const rows = await retry(() => request<{ spelling: string; narrator_id: number }[]>('narrator_map'));
      return new Map(rows.map((r) => [r.spelling, r.narrator_id]));
    }),

  /** all printed spellings of the same person as this one (just itself when unknown) */
  narratorSpellings: (name: string) =>
    cached(`ns:${name}`, async () => {
      const rows = await request<{ spelling: string }[]>('narrator_spellings', { name });
      return rows.length ? rows.map((x) => x.spelling) : [name];
    }),

  /** hadith count for a narrator, all spellings of the name together */
  narratorCount: async (name: string) => (await request<{ n: number }>('narrator_count', { name })).n,

  narratorByName: (name: string, offset = 0, limit = 30) =>
    request<{ rows: Hadith[]; total: number }>('narrator_by_name', { name, offset, limit }),

  narrator: (id: number) => cached(`narrator:${id}`, () => retry(() => request<Narrator>('narrator', { id }))),

  /** total hadith in the library (for random / daily picks) */
  hadithCount: async () => (await request<{ n: number }>('hadith_count')).n,
  /** the hadith at position n (0-based) in id order */
  hadithAt: async (n: number) => (await request<Hadith[]>('hadith_at', { n }))[0] ?? null,
  /** one hadith by book and printed number */
  hadithByNumber: (bookId: number, no: number) => request<Hadith[]>('hadith_by_number', { book: bookId, no }),
  /** today's hadith: the same for everyone on a given day */
  dailyHadith: async () => {
    const n = await api.hadithCount();
    if (!n) return null;
    const day = Math.floor(Date.now() / 86400000);
    return api.hadithAt((day * 7919) % n);
  },
  narratorHadiths: (id: number, offset = 0, limit = 30) =>
    request<Hadith[]>('narrator_hadiths', { id, limit, offset }),

  sources: () => lookup('sources', () => retry(() => request<Source[]>('sources'))),

  search: async (
    q: string,
    opts: { vol?: number | null; book?: number | null; src?: string | null; limit?: number; offset?: number; sort?: 'relevance' | 'book'; narr?: string[]; ngroup?: string | null } = {},
  ) => {
    const ex = expandQuery(q);
    return retry(() =>
      request<Hadith[]>('search', {}, {
        q, vol: opts.vol ?? null, book: opts.book ?? null, src: opts.src ?? null,
        lim: opts.limit ?? 30, off: opts.offset ?? 0,
        sort: opts.sort ?? 'relevance', terms: ex.terms, narr: [...ex.narrators, ...(opts.narr ?? [])], ngroup: opts.ngroup ?? null,
      }),
    );
  },

  /** suggestions while typing: narrators, chapters, books */
  suggest: (q: string) => request<Suggestion[]>('suggest', { q }),

  searchTitles: (q: string) => request<TitleHit[]>('search_titles', { q }),

  hadithOfDay: () => cached('hod', async () => (await request<Hadith[]>('hadith_of_day'))[0] ?? null),

  /** the hadith of a given day (same pick for everyone on that date) */
  hadithOn: async (d: Date) => {
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return (await request<Hadith[]>('hadith_of_day', { d: day }))[0] ?? null;
  },

  articles: () => lookup('articles', () => retry(() => request<Article[]>('articles'))),

  article: (id: number) => cached(`a:${id}`, () => retry(() => request<{ article: Article; blocks: ArticleBlock[] }>('article', { id }))),
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
