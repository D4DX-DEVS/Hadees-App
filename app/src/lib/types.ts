export type Volume = { id: number; title_ml: string };

export type Book = {
  id: number; volume_id: number; book_no: number; title_ml: string; title_ar: string | null;
  start_page: number | null; hadith_count: number; chapter_count: number;
};

export type Chapter = {
  id: number; book_id: number; chapter_no: number; title_ml: string; title_ar: string | null;
  start_page: number | null; hadith_count: number; first_no: number | null; last_no: number | null;
};

export type Hadith = {
  id: number; book_id: number; chapter_id: number | null; hadith_no: number; hadith_label: string | null;
  arabic_text: string; malayalam_text: string; narrator_ar: string | null; narrator_ml: string | null;
  explanation_ml?: string | null; source_codes_ar: string[] | null; source_codes_ml: string[] | null;
  grading_note_ar?: string | null; grading_note_ml: string | null; page_start?: number | null; page_end?: number | null;
  group_id?: number | null;
  // joined (hadith_full / app_search)
  volume_id: number; book_no: number; book_title_ml: string; book_title_ar?: string | null;
  chapter_no: number | null; chapter_title_ml: string | null; chapter_title_ar?: string | null;
  rank?: number; total?: number; similarity?: number;
};

export type Variant = { id: number; hadith_id: number; seq: number; arabic_text: string | null; malayalam_text: string | null };

export type CrossRef = {
  hadith_id: number; hadith_no: number; hadith_label: string | null; volume_id: number; book_id: number;
  book_no: number; book_title: string; chapter_id: number | null; chapter_no: number | null; chapter_title: string | null;
  relation: 'duplicate' | 'variant' | 'partial'; score: number; cross_book: boolean;
  narrator_ml: string | null; snippet: string; source_codes_ml: string[] | null;
};

export type TitleHit = {
  kind: 'book' | 'chapter'; id: number; book_id: number; volume_id: number; book_no: number;
  chapter_no: number | null; title_ml: string; title_ar: string | null;
};

export type Article = { id: number; volume_id: number; section_no: number; title_ml: string; start_page: number | null; end_page: number | null };
export type ArticleBlock = {
  id: number; article_id: number; seq: number;
  kind: 'heading' | 'subheading' | 'paragraph' | 'arabic' | 'list_item' | 'table' | 'footnote';
  text_ml: string | null; rows: string[][] | null; page: number | null;
};

export type Narrator = {
  id: number; name_ml: string; bio_ml: string; page: number | null; article_id: number | null;
  source_note: string | null; hadith_count: number;
};

export type Source = { code_ar: string; code_ml: string; name_en: string; name_ml: string | null; name_ar: string | null };

/** Minimal snapshot stored with bookmarks / history so they render offline. */
export type HadithSnap = Pick<
  Hadith,
  'id' | 'hadith_no' | 'hadith_label' | 'malayalam_text' | 'volume_id' | 'book_no' | 'book_title_ml' | 'chapter_no' | 'chapter_title_ml' | 'narrator_ml'
>;

export const snap = (h: Hadith): HadithSnap => ({
  id: h.id, hadith_no: h.hadith_no, hadith_label: h.hadith_label, malayalam_text: h.malayalam_text.slice(0, 400),
  volume_id: h.volume_id, book_no: h.book_no, book_title_ml: h.book_title_ml, chapter_no: h.chapter_no, chapter_title_ml: h.chapter_title_ml,
  narrator_ml: h.narrator_ml,
});

export type Suggestion = { kind: 'narrator' | 'chapter' | 'book'; label: string; id: number | null; n: number; key: string | null };
