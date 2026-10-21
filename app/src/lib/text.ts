import type { Hadith } from './types';
// Text helpers shared by search + reader.

const HARAKAT = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

export const stripHarakat = (t: string) => t.replace(HARAKAT, '');

export const isArabic = (t: string) => /[؀-ۿ]/.test(t);

/** Same folding as the DB's ml_search_key(): old print forms -> modern Unicode. */
export function mlKey(t: string) {
  return t
    .replace(/ണ്‍/g, 'ൺ').replace(/ന്‍/g, 'ൻ').replace(/ര്‍/g, 'ർ')
    .replace(/ല്‍/g, 'ൽ').replace(/ള്‍/g, 'ൾ')
    .replace(/ഈൗ|ഇൗ/g, 'ഈ').replace(/ഉൗ/g, 'ഊ').replace(/ഒൗ/g, 'ഔ')
    .replace(/ൊ/g, 'ൊ').replace(/ോ/g, 'ോ').replace(/ൌ/g, 'ൌ')
    .replace(/ളള/g, 'ള്ള').replace(/ററ/g, 'റ്റ').replace(/ൻമ/g, 'ന്മ').replace(/ബ്വ/g, 'ബ്ബ')
    .replace(/[‌‍]/g, '')
    .toLowerCase();
}

export type Segment = { text: string; hit: boolean };

/**
 * Split `text` into hit / non-hit segments for `query`.
 * Matching is done on a folded copy; offsets map back 1:1 only when folding keeps length,
 * so we fall back to plain case-insensitive matching on the original text.
 */
export function highlight(text: string, query: string | undefined): Segment[] {
  const q = (query ?? '').trim();
  if (!q || q.length < 2) return [{ text, hit: false }];
  const arabic = isArabic(q);
  const terms = q.split(/\s+/).filter((w) => w.length > 1);
  if (!terms.length) return [{ text, hit: false }];

  // Arabic: allow harakat between letters.
  const pattern = terms
    .map((w) => {
      if (arabic) {
        return [...stripHarakat(w)].map((ch) => escapeRe(ch)).join('[\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u0640]*');
      }
      return escapeRe(w);
    })
    .join('|');
  let re: RegExp;
  try {
    re = new RegExp(`(${pattern})`, 'gi');
  } catch {
    return [{ text, hit: false }];
  }
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), hit: false });
    out.push({ text: m[0], hit: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  return out.length ? out : [{ text, hit: false }];
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A short excerpt around the first hit (for result lists). */
export function excerpt(text: string, query: string | undefined, len = 220): string {
  const q = (query ?? '').trim().split(/\s+/)[0];
  if (!q || isArabic(q)) return text.length > len ? text.slice(0, len).trimEnd() + '…' : text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0 || text.length <= len) return text.length > len ? text.slice(0, len).trimEnd() + '…' : text;
  let start = Math.max(0, i - 60);
  // don't start on a combining sign (Malayalam vowel signs / virama / ZWJ) or mid-word
  while (start > 0 && start < i && /[\u0D00-\u0D03\u0D3B-\u0D4D\u0D57\u0D62\u0D63\u200C\u200D\S]/.test(text[start]) && !/\s/.test(text[start - 1])) start++;
  return (start > 0 ? '…' : '') + text.slice(start, start + len).trim() + (start + len < text.length ? '…' : '');
}

/** Full citation: "Vol 1 · <book title> · Ch. 3 · Hadith 19" */
export function citation(h: {
  volume_id: number; book_title_ml: string; chapter_no?: number | null; hadith_no: number; hadith_label?: string | null;
}, withNumber = true) {
  const no = h.hadith_no >= 10001 ? (h.hadith_label ?? '') : `Hadith ${h.hadith_no}`;
  return [`Vol ${h.volume_id}`, h.book_title_ml, h.chapter_no ? `Ch. ${h.chapter_no}` : null, withNumber ? no : null].filter(Boolean).join(' · ');
}

/**
 * Preview for list cards: whole sentences only (never cut mid-sentence).
 * Starts at the sentence containing the first search hit (so the match is visible), then takes up to
 * `maxSentences` sentences / ~`maxChars` characters. `more` = there is text before or after what is shown.
 */
export function previewText(text: string, query?: string, maxSentences = 3, maxChars = 320) {
  const sentences = text.trim().split(/(?<=[.?!”"])\s+/).filter(Boolean);
  if (sentences.length <= 1 && text.length <= maxChars) return { text: text.trim(), more: false };
  let start = 0;
  const q = (query ?? '').trim().split(/\s+/)[0];
  if (q && q.length > 1) {
    const i = sentences.findIndex((s) => s.toLowerCase().includes(q.toLowerCase()));
    if (i > 0) start = i;
  }
  let out = '';
  let n = 0;
  for (let i = start; i < sentences.length && n < maxSentences; i++) {
    if (out && (out + ' ' + sentences[i]).length > maxChars) break;
    out = out ? out + ' ' + sentences[i] : sentences[i];
    n++;
  }
  const more = start > 0 || start + n < sentences.length;
  return { text: out, more };
}

/** The Malayalam text starts with "narrator(റ): ..." — drop it when the narrator is already shown on its own line. */
export function stripNarrator(text: string, narrator: string | null | undefined) {
  if (!narrator) return text;
  const t = text.trimStart();
  for (const sep of [': ', ':', ' : ']) {
    if (t.startsWith(narrator + sep)) return t.slice(narrator.length + sep.length).trimStart();
  }
  return text;
}

export const hadithNo = (h: { hadith_no: number; hadith_label?: string | null }) =>
  h.hadith_no >= 10001 ? '•' : String(h.hadith_no);

export const toArabicDigits = (n: number | string) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);

/** plain-text version of a hadith for copy / share */
export function shareText(h: Hadith) {
  const src = h.source_codes_ml?.length ? ` (${h.source_codes_ml.join(', ')})` : '';
  return [
    h.arabic_text,
    '',
    h.malayalam_text + src,
    '',
    `— Hadees Vijnanakosham, ${citation(h)}`,
  ].join('\n');
}
