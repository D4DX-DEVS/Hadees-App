# Verification pass (diff only) — Gemini-read pages

Every page was read once by another agent (who often did not finish a re-read). Your job is the **independent second read**: compare the page JSON with the scan image and report ONLY the places where the JSON differs from the print. Do NOT rewrite or re-transcribe pages, do NOT edit the page JSON files.

## How
1. Work in your private folder `$SCRATCH/agents/<tag>/`. Never `pkill`/`killall`.
2. Render each page: `pdftoppm -f N -l N -r 200 -jpeg "<pdf>" <folder>/pg` (if sideways, rotate). Look at it in 2–4 horizontal strips (crop with `sips -c <h> <w> --cropOffset <y> 0`) so harakat and Malayalam signs are legible.
3. Read `/Users/d4-ceo/Desktop/hadeeth/ocr/v1/<part>/pages/pNNN.json` and compare block by block, looking hardest at: Arabic harakat (kasra/damma/fatha/shadda/tanween), Arabic source codes in `(...)`, Malayalam chillu letters and vowel signs (ു/ൂ), hadith numbers, block structure (a bab / arabic / malayalam block in the wrong place or merged), and dropped/duplicated lines.
4. Keep misprints that are printed that way in the book (do not "fix" the author's typos). Only correct where the JSON disagrees with the print.

## Hard rule: no guessing
If you cannot actually view a page image (read error, "media removed", blank), do NOT report corrections for that page and do NOT list it in `pages_checked`; put it in `"not_checked": [page numbers]` instead. Corrections must come from comparing the print you saw, never from what the text "should" say.

## Output: `/Users/d4-ceo/Desktop/hadeeth/ocr/v1/<part>/corrections/<tag>.json`
```json
{
  "part": "1.2",
  "pages_checked": [1, 2, 3],
  "corrections": [
    {"pdf_page": 2, "block": 3, "old": "short exact substring from the JSON block", "new": "replacement", "why": "kasra missing"}
  ],
  "uncertain": [
    {"pdf_page": 2, "hadith_no": 14, "note": "could not read second line"}
  ]
}
```
- `block` = index in that page's `blocks` array. `old` must be an EXACT substring of that block's text (or of its `arabic`/`malayalam` field for bab/book_heading blocks), long enough to be unique within the block (usually 8–40 characters). `new` replaces it. One fix per entry.
- Structural problems you cannot express as a replacement (a block merged/split/misplaced, a missing line): add to `uncertain` with a clear note.
- A page with no differences simply appears in `pages_checked` with no corrections. List EVERY page you actually compared in `pages_checked`.

## Final report (≤100 words)
Pages checked, number of corrections, number of uncertain notes, and what kinds of errors were most common.
If you decline for any reason, say so in the first line and write nothing.

## Vol 1 additions (read carefully)
- PDFs: `/Users/d4-ceo/Desktop/hadeeth/src_v1/1.N.pdf`. Part N pdf page numbering as in page files. Output file: `ocr/v1/<part>/corrections/<tag>.json`.
- Compare EVERY block of EVERY page in your range: Arabic words, Arabic harakat, hadith numbers, source codes (Arabic خ م ق د ت ن جه, Malayalam ബു മു ...), Malayalam words incl. chillu/vowel signs, quotes, bab headings, footnote markers, missing/duplicated lines, blocks in wrong place.
- Arabic harakat policy (revised): the print's vowelling is irregular and mark-by-mark comparison is impractical. Check strictly the consonant SKELETON of every Arabic word (letters, hamza forms, alif/ya/ta marbuta, spacing, missing/duplicate words), hadith numbers and source codes. For harakat, correct only a mark that is clearly WRONG (a different vowel than printed, changing the reading). Do NOT report marks that are merely present in the JSON but absent in print (extra vowelling is acceptable), and do not report missing marks.
- The previous agent could not always re-view pages and edited some words by guess (e.g. via sed). Do not trust any word; verify against the image. If an image is unreadable for you → `not_checked`.
- Malayalam `ള്ള` vs `ളള`: ignore this difference (normalised by script later). Keep printed misspellings (do not fix the author's typos).
- If a word is unreadable even zoomed in, put it in `uncertain` with the page/hadith; never guess.
- In `pages_checked` list only pages you really compared. Report (≤120 words): pages checked, #corrections, #uncertain, main error kinds.
