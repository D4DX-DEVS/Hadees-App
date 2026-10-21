/** Hadith collections cited in the book (codes as printed). */
type Info = { short: string; full: string; ar: string; ml: string };

export const SOURCES: Record<string, Info> = {
  'ബു': { short: 'Bukhari', full: 'Sahih al-Bukhari', ar: 'صحيح البخاري', ml: 'ബുഖാരി' },
  'മു': { short: 'Muslim', full: 'Sahih Muslim', ar: 'صحيح مسلم', ml: 'മുസ്ലിം' },
  'ന': { short: "Nasa'i", full: "Sunan an-Nasa'i", ar: 'سنن النسائي', ml: 'നസാഈ' },
  'തു': { short: 'Tirmidhi', full: "Jami' at-Tirmidhi", ar: 'جامع الترمذي', ml: 'തുർമുദി' },
  'ദ': { short: 'Abu Dawud', full: 'Sunan Abi Dawud', ar: 'سنن أبي داود', ml: 'അബൂദാവൂദ്' },
  'ജ': { short: 'Ibn Majah', full: 'Sunan Ibn Majah', ar: 'سنن ابن ماجه', ml: 'ഇബ്നുമാജ' },
};

/** Display name for a printed code; unknown/misprinted codes are shown as printed. */
export function sourceName(code: string, kind: 'short' | 'full' = 'full') {
  return SOURCES[code]?.[kind] ?? code;
}

export const sourceList = (codes: string[] | null | undefined, kind: 'short' | 'full' = 'short') =>
  (codes ?? []).map((c) => sourceName(c, kind)).join(' · ');
