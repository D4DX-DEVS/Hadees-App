# Volume 2 — review & rescan reference

Generated 2026-10-09 from the live Supabase DB (project `hadeeth`) and `ocr/<part>/verified.json`.

Volume 2 is fully loaded: **14 books (2–15), 3,574 hadith, 1,312 chapters, 366 variants, 474 cross-links**. Books 1 and 16 (intro / about the author) are in the index but have no hadith.

How to find a hadith: `select * from hadith_full where book_no=<B> and hadith_no=<N>` (or filter `needs_review = true`). PDF file names are in `~/Downloads`; "PDF page" = page number inside that PDF (not the printed number).

## Summary

| Item | Count |
|---|---|
| Still `needs_review` (manual review) | 17 |
| Hadith with an unreadable word `[?]` (needs rescan) | 5 |
| Hadith with no source code | 1 |
| Hadith with no Arabic narrator | 14 |
| Hadith with no Malayalam narrator | 5 |

## A. Rescan wanted — unreadable word `[?]` (scan damaged)

Agents re-read these at 300 dpi: damage is in the scan itself. A clean rescan of these pages (or just typing the word from a clean copy) would fix them. After a rescan, give the corrected word and I update the page JSON, rebuild, reload.

| Book | Chapter | Hadith | Printed page | PDF | PDF page | Detail |
|---|---|---|---|---|---|---|
| 3 സകാത്ത് | 36. ധനികന്റെ യാചന | #103 | 178 | vol 2.2 .pdf | 34 | thumb covers line start ("... [?]ന്നതു കൊണ്ടു"); also second [?] |
| 4 ഹജ്ജ് | 8. റമദാനിലെ ഉംറയുടെ ശ്രേഷ്ഠത | #36 | 261 | vol 2.3.pdf | 9 | word before صلى faded (likely اللهِ, not readable); second [?] after على faded — contains `[?]`, see section A |
| 4 ഹജ്ജ് | 51. സുഗന്ധം പുരട്ടേണ്ട സ്ഥലം | #206 | 307 | vol 2.3.pdf | 55 | "بِقَطِرَا[?] [?]بُّ" – faded (بقطران? / أحب?) — contains `[?]`, see section A |
| 4 ഹജ്ജ് | 55. ഇഹ്റാം ചെയ്തയാൾ തന്റെ ഭൃത്യനെ  | #212 | 308–309 | vol 2.3.pdf | 57 (printed 309) | "ഈ വാ[?]ല്ലാതെ" – middle glyph damaged — contains `[?]`, see section A |
| 9 നന്മചെയ്യലും ബന്ധം പുലർത്തലും | 25. ഉടമക്കെതിരെ അടിമയെ പ്രലോഭിപ്പി | #89 | 766 | vol 2.8.pdf | 22 | "അയാൾ[?]തിരിൽ" – smudge covers a letter — contains `[?]`, see section A |

## B. Manual review — `needs_review` (spelling doubts)

Each row: what the checker agents were unsure about. Most are spelling variants where the print is smudged or inconsistent; none block the app.

| Book | Chapter | Hadith | Printed page | PDF | PDF page | Detail |
|---|---|---|---|---|---|---|
| 3 സകാത്ത് | 36. ധനികന്റെ യാചന | #103 | 178 | vol 2.2 .pdf | 34 | അബ്ദുല്ലാഹിബ്നു മസ്ഊദ്(റ): നബി(സ) പറഞ്ഞു: "മറ്റുള്ളവരിൽ നിന്ന് ഐശ്വര്യ — contains `[?]`, see section A |
| 3 സകാത്ത് | 48. വിഭജിച്ചതിനെ കൂട്ടലും കൂട്ടത്ത | #128 | 190 | Vol 2 missing pages (190-191).pdf | 1 | സുവൈദുബ്നു ഗഫല(റ): നബി(സ)യുടെ സകാത്ത്പിരിവുകാരൻ ഞങ്ങളുടെ അടുത്തേക്ക് വ — pages recovered from the separate missing-pages PDF (Gemini read, then second-read by Sonnet; not human-checked) |
| 3 സകാത്ത് | 49. സകാത്ത് പിരിവുകാരും അനുബന്ധ കാ | #129 | 190 | Vol 2 missing pages (190-191).pdf | 1 | അനസ്(റ): അല്ലാഹു തന്റെ പ്രവാചകർ(സ)യോട് കൽപ്പിച്ച കാര്യം അബൂബക്കർ(റ) അദ — pages recovered from the separate missing-pages PDF (Gemini read, then second-read by Sonnet; not human-checked) |
| 3 സകാത്ത് | 49. സകാത്ത് പിരിവുകാരും അനുബന്ധ കാ | #130 | 190 | Vol 2 missing pages (190-191).pdf | 1 | ഇബ്നുഅബ്ബാസ്(റ): മുആദ്(റ)വിനെ യമനിലേക്കയച്ച സംഭവം മുന്നെ പറഞ്ഞു. ഈ നിവ — pages recovered from the separate missing-pages PDF (Gemini read, then second-read by Sonnet; not human-checked) |
| 3 സകാത്ത് | 49. സകാത്ത് പിരിവുകാരും അനുബന്ധ കാ | #131 | 190–191 | Vol 2 missing pages (190-191).pdf | 1 | സുവൈദ് ബിൻ ഗഫല(റ): ഞാൻ നബി(സ)യുടെ സകാത്ത് പിരിവുകാരനോടു കൂടെ സഞ്ചരിച്ച — pages recovered from the separate missing-pages PDF (Gemini read, then second-read by Sonnet; not human-checked) |
| 3 സകാത്ത് | 49. സകാത്ത് പിരിവുകാരും അനുബന്ധ കാ | #132 | 191 | Vol 2 missing pages (190-191).pdf | 2 | ഇബ്നുസ്സാഇദീ(റ): ഉമർ(റ) സകാത്ത് പിരിക്കാൻ എന്നെ ഏൽപ്പിച്ചു. അങ്ങനെ പിര — pages recovered from the separate missing-pages PDF (Gemini read, then second-read by Sonnet; not human-checked) |
| 3 സകാത്ത് | 49. സകാത്ത് പിരിവുകാരും അനുബന്ധ കാ | #133 | 191–192 | Vol 2 missing pages (190-191).pdf | 2 | മുസ്‌ലിമുബ്നു സഫ്നതിൽ യശ്കുരീ(റ): നാഫിഉബ്നു അൽഖമ(റ) എന്റെ പിതാവിനെ തന് — pages recovered from the separate missing-pages PDF (Gemini read, then second-read by Sonnet; not human-checked) |
| 4 ഹജ്ജ് | 8. റമദാനിലെ ഉംറയുടെ ശ്രേഷ്ഠത | #36 | 261 | vol 2.3.pdf | 9 | ഇബ്നുഅബ്ബാസ്(റ): റസൂൽ(സ) ഹജ്ജിന് പോകാനൊരുങ്ങി. അപ്പോൾ ഒരു സ്ത്രീ തന്റെ — contains `[?]`, see section A |
| 4 ഹജ്ജ് | 51. സുഗന്ധം പുരട്ടേണ്ട സ്ഥലം | #206 | 307 | vol 2.3.pdf | 55 | മുഹമ്മദ് ബിൻ മുൻതശിർ(റ): ഇഹ്റാമിന്റെ അവസരത്തിൽ സുഗന്ധം ഉപയോഗിക്കുന്നതി — contains `[?]`, see section A |
| 4 ഹജ്ജ് | 55. ഇഹ്റാം ചെയ്തയാൾ തന്റെ ഭൃത്യനെ  | #212 | 308–309 | vol 2.3.pdf | 57 (printed 309) | അസ്മാഅ് ബിൻത്അബീബക്കർ(റ): ഞങ്ങൾ റസൂൽ(സ)യോടൊപ്പം ഹാജിമാരായി പുറപ്പെട്ടു — contains `[?]`, see section A |
| 7 പാനീയങ്ങൾ | 9. മദ്യം സുർക്കയാക്കൽ | #28 | 599 | vol 2.6.pdf | 9 | Malayalam last lines: print partly smudged near 'അത്. നിക്ക് സുർക്കയാക്കാമോ'; could not read exactly |
| 7 പാനീയങ്ങൾ | 24. അനുവദനീയമായ പാനീയങ്ങൾ | #بدون رقم (بعد 127) | 621 | vol 2.6.pdf | 31 | അനസ്(റ): ഉമ്മുസലൈം(റ)ക്ക് മരക്ഷണത്താലുള്ള ഒരു പാത്രമുണ്ടായിരുന്നു. അവർ |
| 8 വസ്ത്രവും ഭംഗിയും | 135. മുടിചീകൽ | #330 | 724 | vol 2.7.pdf | 84 | Malayalam name hasib: print looks like ഹസ്വീബ്/ഹസീബ് unclear |
| 9 നന്മചെയ്യലും ബന്ധം പുലർത്തലും | 25. ഉടമക്കെതിരെ അടിമയെ പ്രലോഭിപ്പി | #89 | 766 | vol 2.8.pdf | 22 | അബൂഹുറൈറ(റ): റസൂൽ(സ) പറഞ്ഞു: "ഒരാളുടെ അടിമയെയോ ഭാര്യയെയോ അയാൾ[?]തിരിൽ — contains `[?]`, see section A |
| 13 പ്രാർത്ഥന | 39. രാവിലെയും വൈകുന്നേരവും തസ്ബീഹു | #144 | 931 | vol 2.12.pdf | 41 | Mal 'അയ്യൂബിൽ' may be 'അയ്യൂബിർ' in print; not certain |
| 13 പ്രാർത്ഥന | 68. ദേഷ്യം വന്നാൽ പറയേണ്ടത് | #202 | 950 | vol 2.12.pdf | 60 | block 8 transliteration 'മിനശ്ശൈത്വാനിർറജീം': print glyph for ത്വ/ഥ in 'ശ്ശൈഥ്വാനി' not clearly resolvable at zoom; left unchanged |
| 14 പശ്ചാത്താപം | 14. സ്വാകാര്യവും അടിമയുടെ കുറ്റ സമ | #16 | 1012 | Vol 2.13 .pdf | 14 | Malayalam name printed as സ്വഫ്‌വാൻ (JSON സ്വാഫ്‌വാൻ) - could not be certain at this resolution |

## C. No source code (خ م ق د ت ن جه)

Print shows only a grading note (no code), so nothing to fix unless the book prints one elsewhere.

| Book | Chapter | Hadith | Printed page | PDF | PDF page | Detail |
|---|---|---|---|---|---|---|
| 4 ഹജ്ജ് | 123. അറഫാ ദിവസത്തെ പ്രസംഗം | #400 | 366–367 | vol 2.3.pdf | 114 | സൈദ് ബിൻ അസ്ലം(റ): ളംറ കുടുംബക്കാരനായ അദ്ദേഹം തന്റെ പിതാവിൽ നിന്നോ പിത |

## D. No Arabic narrator

Narrator in `narrator_ar` could not be extracted (usually no "عَنْ …" opening). Malayalam narrator may still be present.

| Book | Chapter | Hadith | Printed page | PDF | PDF page | Detail |
|---|---|---|---|---|---|---|
| 2 നോമ്പ് | 26. തുടർവ്രതം നിരോധിതം | #115 | 79 | vol 2.1.pdf | 31 | ഈ നിവേദനത്തിൽ നിവേദകൻ പറയുന്നു: തിരുമേനി(സ)യുടെ ഇളവ് സ്വീകരിച്ചിരുന്നു |
| 3 സകാത്ത് | 48. വിഭജിച്ചതിനെ കൂട്ടലും കൂട്ടത്ത | #127 | 189–190 | vol 2.2 .pdf | 45 | മാലിക്(റ) പറഞ്ഞു: 'വിഭിന്നമായതിനെ കൂട്ടപ്പെടുകയില്ല, കൂട്ടത്തെ വിഭജിക് |
| 5 മര്യാദ | 104. വർഗീയത | #236 | 461 | vol 2.4.pdf | 61 | അബ്ദുല്ലാഹിബ്നു മസ്ഊദ്(റ): അന്യായമായി സ്വന്തം സമൂഹത്തെ ആരെങ്കിലും സഹായ |
| 7 പാനീയങ്ങൾ | 1. മദ്യപാനം | #1 | 591 | vol 2.6.pdf | 1 | പരിശുദ്ധനും ഉന്നതനുമായ അല്ലാഹു പറയുന്നു: 'വിശ്വാസികളേ, മദ്യവും ചൂതാട്ട |
| 11 വിജ്ഞാനത്തിന്റെ ശ്രേഷ്ഠത | 49. തനിക്ക് പിറകിലായി ആരെങ്കിലും ന | #147 | 879 | vol 2.10.pdf | 43 | ജാബിറുബ്‌നു അബ്ദില്ല(റ): തിരുനബി(സ) സഞ്ചരിക്കുമ്പോൾ അവിടുത്തെ അനുചരർ അ |
| 11 വിജ്ഞാനത്തിന്റെ ശ്രേഷ്ഠത | 50. ജ്ഞാനം തേടാൻ വസിയ്യത്ത് ചെയ്യൽ | #148 | 879 | vol 2.10.pdf | 43 | അബൂസഈദിനിൽ ഖുദ്‌രി(റ): റസൂൽ(സ) പറഞ്ഞു: “ജ്ഞാനവും തേടി നിങ്ങളിലേക്ക് ജന |
| 11 വിജ്ഞാനത്തിന്റെ ശ്രേഷ്ഠത | 50. ജ്ഞാനം തേടാൻ വസിയ്യത്ത് ചെയ്യൽ | #149 | 879 | vol 2.10.pdf | 43 | അബൂഹുറൈറ(റ): ഞങ്ങൾ റസൂൽ(സ)യുടെ അടുത്തേക്ക് കടന്നുവന്നു. അങ്ങനെ വീട് നി |
| 11 വിജ്ഞാനത്തിന്റെ ശ്രേഷ്ഠത | 50. ജ്ഞാനം തേടാൻ വസിയ്യത്ത് ചെയ്യൽ | #150 | 879 | vol 2.10.pdf | 43 | അബൂഹാറൂനൽ അബ്ദി(റ): ഞങ്ങൾ അബൂസഈദിനിൽ ഖുദ്‌രി(റ)വിന്റെയടുത്ത് ചെന്നാൽ അ |
| 11 വിജ്ഞാനത്തിന്റെ ശ്രേഷ്ഠത | 51. ജ്ഞാനം ഉപകരിക്കലും അതനുസരിച്ച് | #151 | 879–880 | vol 2.10.pdf | 43 | അബൂഹുറൈറ(റ): തിരുനബി(സ)യുടെ പ്രാർത്ഥനയിൽ പെട്ടതായിരുന്നു: "അല്ലാഹുവേ,  |
| 13 പ്രാർത്ഥന | 8. മാപ്പിനും ആരോഗ്യത്തിനും വേണ്ടി | #47 | 903 | vol 2.12.pdf | 13 | ഇബ്നുഉമർ(റ): റസൂൽ(സ) പറഞ്ഞു: "ആരോഗ്യത്തെ ചോദിക്കുന്നതിനേക്കാൾ അല്ലാഹുവ |
| 13 പ്രാർത്ഥന | 8. മാപ്പിനും ആരോഗ്യത്തിനും വേണ്ടി | #48 | 903 | vol 2.12.pdf | 13 | അബൂബക്കർ(റ): റസൂൽ(സ) അന്ത്യ യാത്രയായ സമയത്ത് അബൂബക്കർ(റ) പ്രസംഗിച്ചു:  |
| 13 പ്രാർത്ഥന | 8. മാപ്പിനും ആരോഗ്യത്തിനും വേണ്ടി | #49 | 903 | vol 2.12.pdf | 13 | അബൂഹുറൈറ(റ): തിരുനബി(സ) പറഞ്ഞു: "അല്ലാഹുവേ, ഇഹത്തിലും പരത്തിലും ഞാൻ നി |
| 13 പ്രാർത്ഥന | 8. മാപ്പിനും ആരോഗ്യത്തിനും വേണ്ടി | #50 | 903 | vol 2.12.pdf | 13 | അനസുബ്നു മാലിക്(റ): റസൂൽ(സ) പറഞ്ഞു: "ബാങ്കിനും ഇഖാമത്തിനുമിടയിൽ പ്രാർത |
| 13 പ്രാർത്ഥന | 9. ശരീരത്തിനും, കാഴ്ചക്കും വേണ്ടി | #51 | 903–904 | vol 2.12.pdf | 13 | ആഇശ(റ): റസൂലുല്ലാഹി(സ) ഇപ്രകാരം പറയുമായിരുന്നു: "അല്ലാഹുവേ, എന്റെ ശരീര |

## E. No Malayalam narrator

| Book | Chapter | Hadith | Printed page | PDF | PDF page | Detail |
|---|---|---|---|---|---|---|
| 2 നോമ്പ് | 53. യാത്രയിലെ നോമ്പ് | #250 | 110 | vol 2.1.pdf | 62 | ബനൂഖുശൈറിന്റെ സഹോദരങ്ങളായ അബ്ദുല്ലാഹിബിൻ കഅ്ബിന്റെ സന്തതികളിലൊരാളായ അന |
| 2 നോമ്പ് | 80. നോമ്പുകാരൻ ഛർദ്ദിച്ചാൽ | #328 | 131 | vol 2.1.pdf | 83 | നബി(സ)യുടെ ഒരു അനുചരനിൽനിന്ന് തന്റെ സുഹൃത്ത് നിവേദനം ചെയ്യുന്നതായി സൈദ |
| 5 മര്യാദ | 183. നേരം പുലർന്നാൽ ചെല്ലേണ്ടത് | #421 | 508–509 | vol 2.4.pdf | 108 | നബി(സ)യുടെ ചില പെൺമക്കൾക്ക് സേവനം ചെയ്തിരുന്ന തന്റെ ഉമ്മയോട് നബി(സ)യുട |
| 8 വസ്ത്രവും ഭംഗിയും | 19. കരിഞ്ഞത് പോലെ കറുത്ത നിറമുള്ള  | #59 | 655 | vol 2.7.pdf | 15 | അംറുബ്നു ഹുറൈസ്(സ): നബി(സ)യുടെ ശിരസ്സിൽ കരിഞ്ഞതുപോലെ കറുത്ത തലപ്പാവ് ഞ |
| 9 നന്മചെയ്യലും ബന്ധം പുലർത്തലും | 103. ചാരവൃത്തി | #284 | 814 | vol 2.8.pdf | 70 | ജുബൈറുബ്നു നുഫൈൽ, കസീറുബ്നു മുർറ, അംറുബ്നു അസ്വദ്, മിഖ്ദാമുബ്നു മഅ്ദീ  |

## Notes

- Gemini-read pages have fuller Arabic harakat than the print; accepted (see memory).
- Misprints printed in the book are kept as printed.
- After any text edit: `python3 -I scripts/build.py <part>`, load `supabase/seed_<part>.sql`, then `python3 -I scripts/relations_batched.py`.
- Page JSON files: `ocr/<part>/pages/pNNN.json` (part 2.N = index book N+1).
