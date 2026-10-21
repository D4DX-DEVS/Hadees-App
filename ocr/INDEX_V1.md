# Index (TOC) transcription — Vol 1 (`src_v1/index.pdf`, 22 pages)
Page = scan of "വിഷയ വിവരം" table of contents: top-level sections `N.title ... page` (bold, larger) with numbered chapters under them, each with the printed page number at right (digits at line end; pages can look mirrored/bleed-through faintly: ignore that, read only dark print). Some titles wrap to 2 lines (join). Titles can end in "..." keep.
Transcribe EXACTLY (Malayalam Unicode, chillu ൽ ൻ ർ ൾ ൺ; keep printed misspellings). Never guess: unreadable → `[?]`.
Output JSON list to the file named in your task:
{"pdf_pages":[a,b],"sections":[{"no":9,"title_ml":"വിശ്വാസം","page":81,"chapters":[{"no":1,"title_ml":"...","page":81},...]}]}
- section with no chapters (e.g. `1.ആമുഖമായി 33`) → "chapters":[].
- If a section continues from the previous pdf page chunk (its heading is on the other agent's pages), use `"continues": true` and omit title/page; just list the chapters you see with their numbers.
- Chapter numbers restart at 1 under each section. Printed footer page numbers of the TOC itself (11,12…) are NOT chapter pages.
- Check: chapter numbers consecutive; page numbers non-decreasing (a misprint is allowed, keep as printed and list it in `notes`).
