import { api, request } from './api';
import { savePack } from './offline';
import type { Chapter, Hadith } from './types';

const PAGE = 500;

/** Fetch every chapter and hadith of a book and keep them on the device. */
export async function downloadBook(bookId: number, onProgress?: (fraction: number) => void) {
  // read from the network even if a pack already exists, so "update" works
  let chapters: Chapter[];
  try {
    chapters = await request<Chapter[]>('chapters', { book: bookId });
  } catch {
    throw new Error('Could not reach the server. Check your connection.');
  }
  const books = await api.books();
  const total = books.find((b) => b.id === bookId)?.hadith_count || 1;
  const hadiths: Hadith[] = [];
  for (let from = 0; ; from += PAGE) {
    const page = await request<Hadith[]>('book_hadiths', { book: bookId, from, to: from + PAGE - 1 });
    hadiths.push(...page);
    onProgress?.(Math.min(0.98, hadiths.length / total));
    if (page.length < PAGE) break;
  }
  await savePack({ bookId, savedAt: new Date().toISOString(), chapters, hadiths });
  onProgress?.(1);
}
