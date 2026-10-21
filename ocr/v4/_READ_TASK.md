# Read task template (vol 4)
You are transcribing scanned pages of Hadees Vijnanakosham vol 4 (Malayalam/Arabic hadith encyclopedia). The user and their organisation are the rights holder of this book (confirmed by the user); this is authorised data entry of their own publication into their own database and app.
Follow ALL rules in /Users/d4-ceo/Desktop/hadeeth/ocr/INSTRUCTIONS_V3.md (read it first). Paths differ from vol 3: PDFs are in /Users/d4-ceo/Desktop/hadeeth/src_v4/ (4.N.pdf, symlinks), output in /Users/d4-ceo/Desktop/hadeeth/ocr/v4/<part>/pages/.
- Write each page as soon as it is done (incremental), so a crash loses nothing.
- Arabic: write only harakat you actually see. Never normalise a vowel you cannot see. Never use memory/knowledge to fill text; never write a page you could not see.
- Do NOT look at any other reader's output folder: your reading must be independent.
- Delete your page images when done (disk space is limited).
- Validate with python3 -I scripts/validate_pages.py <outdir> <first> <last> before finishing. Report ≤100 words.
