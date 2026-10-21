# OCR of the prose (non-hadith) pages of Vol 1 — same rules as ocr/INSTRUCTIONS_V1.md, different block types
Sources (PDF → printed pages): `src_v1/intro.pdf` (3 pdf pages; index section 1 "ആമുഖമായി" starts printed p.33), `src_v1/article.pdf` (34 pdf pages, printed pp.37-70: sections 2 അവതാരിക 37, 3 ഗുണകാംക്ഷ 39, 4 മുഹമ്മദ് നബി(സ): ഒരു ലഘു ചരിത്രം 43, 5 ഹദീസുകൾ (നബി വചനങ്ങൾ) 51, 6 പ്രധാന ഹദീസ് ഗ്രന്ഥങ്ങളും കർത്താക്കളും 61, 7 ചില പ്രധാന ഹദീസ് നിവേദകർ 63 … to p.70).
Rules from INSTRUCTIONS_V1.md apply: transcribe EXACTLY as printed, native-resolution crops (`pdfimages -f N -l N -j`), one page at a time, never write text you have not seen, keep printed misspellings, `[?]` only if truly unreadable, ASCII quotes, chillu letters, ignore header/footer (`വാല്യം:1`, `ഹദീസ് വിജ്ഞാനകോശം`, `വിഷയവിവരം` etc.) and bleed-through.
Output one JSON per pdf page `pNNN.json`:
{"pdf_page":N,"printed_page":P,"starts_mid_word":false,"blocks":[
 {"type":"heading","text":"..."},         # section title (big display lettering, e.g. അവതാരിക) 
 {"type":"subheading","text":"..."},      # smaller bold/underlined headings inside a section
 {"type":"paragraph","text":"..."},       # one printed paragraph (new paragraph = indented first line); join wrapped lines; a paragraph that continues from the previous page is simply the first block of this page
 {"type":"arabic","text":"..."},          # an Arabic quotation (Quran/hadith) set on its own, with harakat as printed
 {"type":"list_item","text":"..."},       # numbered/bulleted list entries, keep their numbering text
 {"type":"table","rows":[["c1","c2"],...]},  # tabular content (e.g. lists of narrators/books with numbers)
 {"type":"footnote","text":"..."}]}
- Verse/hadith references in brackets stay in the paragraph text as printed (e.g. (അന്നഹ്ൽ: 44)).
- Non-Malayalam scripts that appear (Arabic, Sanskrit in Malayalam letters, Latin) are transcribed as printed.
- `starts_mid_word`: first word is the 2nd half of a word split across the page break.
- Validate with `python3 -I /Users/d4-ceo/Desktop/hadeeth/scripts/validate_art.py <dir> <first> <last>` (valid JSON, pdf_page, printed_page, block types).
