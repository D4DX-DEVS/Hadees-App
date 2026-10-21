# Audit task: compare DB hadith text with the printed scan
Input: a JSON list of items {book, hadith_no, pdf, pdf_pages, arabic, malayalam[, focus]}.
For EACH item: render the listed pdf page(s) at native resolution (`pdfimages -f N -l N -j <pdf> <prefix>`), find the hadith by its Arabic-Indic number, crop into strips, and compare the PRINT word by word with `arabic` and `malayalam`.
- Ignore Arabic harakat differences unless a mark clearly changes the word. Ignore spacing and quote-mark style. ഇൗ = ഈ (same).
- Printed misspellings are kept on purpose: if the DB matches a misprint, that is CORRECT.
- Report every real difference (missing / extra / wrong word, wrong number, wrong source code, text belonging to another hadith).
Output JSON (path given in your task): [{"book":B,"hadith_no":N,"verdict":"match"|"diff"|"unsure","diffs":[{"field":"arabic|malayalam","db":"..","print":".."}],"note":".."}].
Write the output after EVERY item. Work one page at a time; delete your images after each item (disk is nearly full). Never guess: unreadable → "unsure".
Report ≤80 words: items checked, #match/#diff/#unsure.
