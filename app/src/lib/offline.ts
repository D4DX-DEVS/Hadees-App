import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { Book, Chapter, Hadith } from './types';

/**
 * Offline books (phones only). A downloaded book is one JSON file in the app's documents folder holding its
 * chapters and every hadith; the api layer reads from it before touching the network.
 * Small lookup lists (volumes, books, sources, articles…) are mirrored in AsyncStorage so the library still opens offline.
 */
export type Pack = { bookId: number; savedAt: string; chapters: Chapter[]; hadiths: Hadith[] };
export type PackInfo = { bookId: number; savedAt: string; bytes: number };

export const offlineSupported = Platform.OS !== 'web';

// expo-file-system is native only; load it lazily so the web build never touches it
function fs() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-file-system') as typeof import('expo-file-system');
}

function dir() {
  const { Directory, Paths } = fs();
  const d = new Directory(Paths.document, 'offline');
  if (!d.exists) d.create({ idempotent: true });
  return d;
}
const file = (bookId: number) => new (fs().File)(dir(), `book-${bookId}.json`);

let packs: Map<number, Pack> | null = null;
let loading: Promise<Map<number, Pack>> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
export const onOfflineChange = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** all downloaded packs, loaded once from disk */
export function loadPacks(): Promise<Map<number, Pack>> {
  if (!offlineSupported) return Promise.resolve(new Map());
  if (packs) return Promise.resolve(packs);
  loading ??= (async () => {
    const m = new Map<number, Pack>();
    try {
      for (const item of dir().list()) {
        if (!/^book-\d+\.json$/.test(item.name)) continue;
        try {
          const p = JSON.parse(await (item as InstanceType<ReturnType<typeof fs>['File']>).text()) as Pack;
          m.set(p.bookId, p);
        } catch {
          // a half-written file: ignore it, the user can download again
        }
      }
    } catch {
      // no folder yet
    }
    packs = m;
    return m;
  })();
  return loading;
}

export async function downloadedBooks(): Promise<PackInfo[]> {
  const m = await loadPacks();
  return [...m.values()].map((p) => ({ bookId: p.bookId, savedAt: p.savedAt, bytes: file(p.bookId).size ?? 0 }));
}

export async function savePack(pack: Pack) {
  const f = file(pack.bookId);
  f.create({ overwrite: true });
  f.write(JSON.stringify(pack));
  (await loadPacks()).set(pack.bookId, pack);
  notify();
}

export async function removePack(bookId: number) {
  const f = file(bookId);
  if (f.exists) f.delete();
  (await loadPacks()).delete(bookId);
  notify();
}

export async function packChapters(bookId: number): Promise<Chapter[] | null> {
  return (await loadPacks()).get(bookId)?.chapters ?? null;
}

export async function packChapterHadiths(chapterId: number): Promise<Hadith[] | null> {
  for (const p of (await loadPacks()).values()) {
    const rows = p.hadiths.filter((h) => h.chapter_id === chapterId);
    if (rows.length) return rows.sort((a, b) => a.hadith_no - b.hadith_no);
  }
  return null;
}

export async function packHadith(id: number): Promise<Hadith | null> {
  for (const p of (await loadPacks()).values()) {
    const h = p.hadiths.find((x) => x.id === id);
    if (h) return h;
  }
  return null;
}

export async function packBookHadiths(bookId: number): Promise<Hadith[] | null> {
  return (await loadPacks()).get(bookId)?.hadiths ?? null;
}

// ───────── small lookups mirrored to AsyncStorage ─────────
const KEY = 'offline-lookup:';
export async function remember(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(KEY + key, JSON.stringify(value));
  } catch {
    // storage full / unavailable: skip
  }
}
export async function recall<T>(key: string): Promise<T | null> {
  try {
    const v = await AsyncStorage.getItem(KEY + key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

export type { Book };
