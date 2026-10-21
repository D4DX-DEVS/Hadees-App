# OCR instructions v2 — Hadees Vijnanakosham Vol 2 (Malayalam/Arabic)

Scanned book pages, no text layer. Each PDF part (`vol 2.N.pdf`) is one book (kitab).
Per hadith: Arabic-Indic number + Arabic matn ending with source code in parens e.g. `(خ)`, `(ن،جه)`,
optional grading note `[ز: في إسناده ضعيف]`; then Malayalam translation ending with Malayalam code e.g. `(ബു)`, `(ന,ജ)`.
Chapters start with `بَابٌ: ...` (Arabic) + underlined Malayalam title. Book title on first page (e.g. كِتَابُ الزَّكَاةِ / സകാത്ത്).

## How to read (quality matters most)
1. Make a PRIVATE work folder: `$SCRATCH/agents/<your-tag>/` (tag given in your task). Never touch other folders, never `pkill`/`killall` anything.
2. Extract page images fast: `pdfimages -f N -l M -j "<pdf>" <folder>/img` (or `pdftoppm -r 200 -png`).
3. Read each page in 2–4 horizontal strips at good resolution (crop with `sips` or python PIL if available, e.g. `sips -c <h> <w> --cropOffset <y> 0`) so harakat and Malayalam signs are legible. Read each strip with the Read tool.
4. Pages may be tilted/staggered: rebuild lines in true reading order by sense.

## Transcription rules
- EXACT as printed. Keep Arabic harakat. Keep printed typos/misprints as-is (do NOT correct them) — list them in your final report instead.
- Unicode Malayalam with chillu letters (ൽ ൻ ർ ൾ ൺ). If print uses virama+ZWJ old style, convert to chillu (that's encoding, not spelling).
- Ignore running headers (book name), footers (`വാല്യം: 2`, `ഹദീസ് വിജ്ഞാനകോശം`, page number), and faint mirrored bleed-through.
- Join words wrapped across LINES. Quote marks `''`/`“”` → `"`; `‘’` → `'`.
- Keep source codes + grading notes inside the text as printed. Comma inside codes: use ASCII `,` (both Arabic and Malayalam).
- Illegible → `[?]`. Never invent.

## Output: one JSON per PDF page: `<outdir>/p{PDFPAGE:03d}.json`
```json
{
  "pdf_page": 1,
  "printed_page": 145,
  "starts_mid_word": false,
  "blocks": [
    {"type": "book_heading", "arabic": "كِتَابُ الزَّكَاةِ", "malayalam": "സകാത്ത്"},
    {"type": "bab", "arabic": "بَابٌ: ...", "malayalam": "..."},
    {"type": "arabic", "hadith_no": 1, "text": "عَنْ ... (خ,م)"},
    {"type": "malayalam", "text": "അബൂഹുറൈറ(റ): ... (ബു,മു)"},
    {"type": "footnote", "text": "* ..."}
  ]
}
```
- `printed_page`: number in the page footer (read it; don't assume).
- `starts_mid_word`: true if the first word on this page is the second half of a word split from the previous page (e.g. prev ends "പറ", this starts "ഞ്ഞു").
- Blocks in reading order. `arabic.hadith_no` = integer (convert ١٢٣ → 123); `null` if page starts mid-hadith Arabic.
  A page-top Malayalam continuation is just a `malayalam` block.
- Several paragraphs of one hadith's translation (e.g. "മറ്റൊരു നിവേദനം…") → one malayalam block, paragraphs joined by `\n`.
- Footnote (asterisk / superscript note at page bottom) → `footnote` block; keep its marker (`*`, `¹`) in both the text and the note.
- Any other non-hadith prose (author's note, intro paragraph) → `{"type": "note", "text": "..."}`.

## Before you finish
Run: `python3 -I /Users/d4-ceo/Desktop/hadeeth/scripts/validate_pages.py <outdir> <first> <last>` and fix everything it reports
(or explain in your report why it is correct as printed).

Final report (short): pages written, first/last hadith number, babs found, misprints kept, uncertain readings with page + hadith no.
