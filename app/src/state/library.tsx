import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { loadList, save } from '@/lib/storage';
import type { HadithSnap } from '@/lib/types';

/** Everything personal lives on the device: bookmarks, notes, search + reading history. */

export type Bookmark = HadithSnap & { savedAt: number; note?: string; folder?: string };
export type SearchEntry = { q: string; mode: 'search' | 'ask'; at: number };
export type ReadEntry = HadithSnap & { at: number };

const K = { bookmarks: 'hv.bookmarks.v1', searches: 'hv.searches.v1', reads: 'hv.reads.v1' };
const MAX_SEARCHES = 40;
const MAX_READS = 60;

type Ctx = {
  bookmarks: Bookmark[];
  searches: SearchEntry[];
  reads: ReadEntry[];
  isBookmarked: (id: number) => boolean;
  toggleBookmark: (h: HadithSnap) => boolean;
  setNote: (id: number, note: string) => void;
  setFolder: (id: number, folder: string | undefined) => void;
  addSearch: (q: string, mode: SearchEntry['mode']) => void;
  removeSearch: (q: string) => void;
  clearSearches: () => void;
  addRead: (h: HadithSnap) => void;
  clearReads: () => void;
};

const LibraryContext = createContext<Ctx | null>(null);

function store<T>(key: string, value: T): T {
  save(key, value);
  return value;
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [searches, setSearches] = useState<SearchEntry[]>([]);
  const [reads, setReads] = useState<ReadEntry[]>([]);

  useEffect(() => {
    loadList<Bookmark>(K.bookmarks).then(setBookmarks);
    loadList<SearchEntry>(K.searches).then(setSearches);
    loadList<ReadEntry>(K.reads).then(setReads);
  }, []);

  // setters that also write through to storage
  const updBookmarks = useCallback((fn: (s: Bookmark[]) => Bookmark[]) => setBookmarks((s) => store(K.bookmarks, fn(s))), []);
  const updSearches = useCallback((fn: (s: SearchEntry[]) => SearchEntry[]) => setSearches((s) => store(K.searches, fn(s))), []);
  const updReads = useCallback((fn: (s: ReadEntry[]) => ReadEntry[]) => setReads((s) => store(K.reads, fn(s))), []);

  const ids = useMemo(() => new Set(bookmarks.map((b) => b.id)), [bookmarks]);

  const value = useMemo<Ctx>(
    () => ({
      bookmarks,
      searches,
      reads,
      isBookmarked: (id) => ids.has(id),
      toggleBookmark: (h) => {
        const on = !ids.has(h.id);
        updBookmarks((s) => (on ? [{ ...h, savedAt: Date.now() }, ...s] : s.filter((b) => b.id !== h.id)));
        return on;
      },
      setNote: (id, note) => updBookmarks((s) => s.map((b) => (b.id === id ? { ...b, note } : b))),
      setFolder: (id, folder) => updBookmarks((s) => s.map((b) => (b.id === id ? { ...b, folder } : b))),
      addSearch: (q, mode) => {
        const t = q.trim();
        if (!t) return;
        updSearches((s) => [{ q: t, mode, at: Date.now() }, ...s.filter((e) => e.q !== t)].slice(0, MAX_SEARCHES));
      },
      removeSearch: (q) => updSearches((s) => s.filter((e) => e.q !== q)),
      clearSearches: () => updSearches(() => []),
      addRead: (h) => updReads((s) => [{ ...h, at: Date.now() }, ...s.filter((e) => e.id !== h.id)].slice(0, MAX_READS)),
      clearReads: () => updReads(() => []),
    }),
    [bookmarks, searches, reads, ids, updBookmarks, updSearches, updReads],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary outside LibraryProvider');
  return ctx;
}
