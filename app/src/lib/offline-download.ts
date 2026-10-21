import { api, supabase } from './api';
import { savePack } from './offline';
import type { Hadith } from './types';

const PAGE = 500;

/** Fetch every chapter and hadith of a book and keep them on the device. */
export async function downloadBook(bookId: number, onProgress?: (fraction: number) => void) {
  // read from the network even if a pack already exists, so "update" works
  const chapters = (await supabase.from('chapter_stats').select('*').eq('book_id', bookId).order('chapter_no')).data;
  if (!chapters) throw new Error('Could not reach the server. Check your connection.');
  const books = await api.books();
  const total = books.find((b) => b.id === bookId)?.hadith_count || 1;
  const hadiths: Hadith[] = [];
  for (let from = 0; ; from += PAGE) {
    const r = await supabase.from('hadith_full').select('*').eq('book_id', bookId).order('hadith_no').range(from, from + PAGE - 1);
    if (r.error) throw new Error(r.error.message);
    hadiths.push(...(r.data as Hadith[]));
    onProgress?.(Math.min(0.98, hadiths.length / total));
    if ((r.data?.length ?? 0) < PAGE) break;
  }
  await savePack({ bookId, savedAt: new Date().toISOString(), chapters, hadiths });
  onProgress?.(1);
}
