# Vol 4 books 3 and 5: manual review (held items)

Generated from `ocr/v4/4.1/verified.json` and `ocr/v4/4.3/verified.json`. Each item is a diff the adjudicator could not settle from the scan. Held = not applied to the text; the DB hadith covering that page is flagged `needs_review = true` (`supabase/flag_held_vol4.sql`).

Decide each item: keep the current text, or give the replacement. Glyph calls (ത്വ/ത, ഘ/ഖ, ഇ/ഉ, ൂ/ു, ്വ, ക്ക/ക്ർ, ൈ/െ) are the usual cause.


## 4.1 (vol 4 book 3): 21 held notes

Pages verified (diffs checked): 27, 28, 30, 32, 33, 34, 35, 36, 37, 38, 41, 42, 44, 45, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 58, 59, 60, 61, 62, 65, 66, 68, 70, 71, 72, 73, 74, 75

- [ ] pdf p27: diff 1: ഞാനവനെ തേടിയാൽ (Sonnet) vs ഞാനവനെത്തേടിയാൽ (Opus); line-justified spacing and ത്ത/ത glyph not decidable at this resolution -> held
- [ ] pdf p28: diff 2 (bab block 0 malayalam): print heading on p28 is a different title (സലബ് ഗവേഷണം നടത്തിയതിന് ശേഷം / കൊന്നവരിൽ ഒരാൾക്ക് നൽകൽ) and the printed word on the page-top paragraph is കൊന്നവന് (Opus); bab block text does not match print -> held, bab block itself needs review
- [ ] pdf p32: idx5 'താങ്കൾക്കറിയില്ലേയോ?' vs Opus 'താങ്കൾക്കറിയില്ലെയോ?' (ലേ / ലെ, vowel sign e vs ee after ല്ല) in the last paragraph line 3 ('വിധിച്ചതെന്ന് താങ്കൾക്കറിയില്ലേയോ?'): sign not decidable at zoom; HELD, not applied
- [ ] pdf p35: idx9 narrator 'അദിയ്യുബ്നു അമീറതുൽ കിന്ദി(റ):' (block 4): print looks like 'കിൻദി' (chillu-like ൻ) per Opus, but ന്/ൻ chillu call not certain at zoom; HELD, not applied (Sonnet 'കിന്ദി' kept)
- [ ] pdf p53: idx34 block 0: അബൂബക്കർ(റ)വിനോട് (Sonnet) vs അബൂബക്ർ(റ)വിനോട് (Opus) in 'അലി(റ) അബൂബക്കർ(റ)വിനോട് സംസാ' - ക്ക vs ക്ർ glyph not decidable at this resolution -> held
- [ ] pdf p53: idx35 block 0: 'അലി(റ) അബൂബക്കർ(റ)' line-end before 'വിനോട് പറഞ്ഞു' - same ക്ക/ക്ർ question -> held
- [ ] pdf p53: idx36 block 5: മുത്വലിബ് (Sonnet) vs മുത്ത്വലിബ് (Opus); doubled ത്ത vs single ത before ്വ not decidable at this resolution -> held (rechecked, earlier call A withdrawn)
- [ ] pdf p54: idx37-42: six മുത്വലിബ് vs മുത്ത്വലിബ് (Opus) - the ത്ത/്വ glyph count could not be decided with certainty at this resolution -> all held
- [ ] pdf p56: idx46-49: മുത്വലിബ് vs മുത്ത്വലിബ് variants - ത്ത/്വ glyph count not decidable -> held
- [ ] pdf p57: idx50 abdulmuthalib (ത്ത/്വ glyph) held; page 57 not viewed visually
- [ ] pdf p58: idx53: അബ്ദുൽമുത്വലിബാണത് vs അബ്ദുൽമുത്ത്വലിബാണത് - ത്ത/്വ glyph not decidable -> held
- [ ] pdf p59: idx55 അബ്ദുൽമുത്വലിബിന്റെ (ത്ത്വ glyph) held
- [ ] pdf p60: idx60 "ഫാതിമ, vs "ഫാത്വിമ, : ത്വ glyph not certain at this crop -> held
- [ ] pdf p66: idx67 block 2: ഖാരിഇഊങ്ങളിൽപെട്ട (Sonnet) vs ഖാരിഊങ്ങളിൽപെട്ട (Opus). Print shows ഇ followed by an ഊ/ൗ-like glyph; cannot decide ഇഊ vs ഊ at native resolution -> held, not applied
- [ ] pdf p70: idx73 block 4: മേഘലയെ (Sonnet) vs മേഖലയെ (Opus). Print glyph after മേ is ഘ/ഖ-like; not decidable with certainty at native resolution -> held, not applied
- [ ] pdf p70: idx74 block 4: മേഘല." (Sonnet) vs മേഖല." (Opus). Same glyph question as idx73 -> held, not applied
- [ ] pdf p71: idx75 block 0: മേഘലയെ (Sonnet) vs മേഖലയെ (Opus); ഘ/ഖ glyph after മേ not decidable -> held
- [ ] pdf p71: idx76 block 0: മേഘലയില്ല." vs മേഖലയില്ല." ; same glyph question -> held
- [ ] pdf p71: idx79 block 2: സ്വഖർ(റ) (Sonnet) vs സ്വഖ്ർ(റ) (Opus) in line "അവർ കീഴടങ്ങുംവരെ സ്വഖർ(റ) അവിടെ"; virama looks present but not certain -> held
- [ ] pdf p71: idx80 block 2: സ്വഖർ(റ) split across lines (നിശ്ചയം സ്വ / ഖ്ർ(റ)); virama not certain at line-break -> held
- [ ] pdf p75: idx90 block 11: "ബഖീഇൽ (Sonnet) vs "ബഖീഉൽ (Opus); vowel glyph before ൽ ഇ vs ഉ not decidable -> held


## 4.3 (vol 4 book 5): 59 held notes

Pages verified (diffs checked): 1, 5, 9, 14, 16, 17, 20, 22, 23, 24, 25, 29, 31, 33, 34, 40, 46, 49, 59, 61, 63, 64, 65, 66, 67, 68, 69, 71, 72, 73, 74, 75, 76, 78, 83

- [ ] pdf p5: idx1 block 1 malayalam: word ദാത്തുന്നിത്വാകൈൻ (A) vs ദാത്തുന്നിത്വാഖൈൻ (B). Glyph after ാ looks like ഖ at native zoom (leans B) but ക/ഖ not certain; HELD, not applied.
- [ ] pdf p9: idx2 block 0 malayalam text: അബുജഹ്ലും (A) vs അബൂജഹ്ലും (B). Vowel after ബ looks like ൂ (leans B) but ു/ൂ is a held glyph call; HELD, not applied.
- [ ] pdf p20: idx7 block 4 arabic poem: print has no separator character between hemistichs (wide blank gap); A has "...", B has "/". Neither matches; not applied. Print: هَلْ أَنْتَ إِلَّا إِصْبَعٌ دَمِيتَ [gap] وَفِي سَبِيلِ اللَّهِ مَا لَقِيتَ". (م)
- [ ] pdf p22: idx9 block 4 bab malayalam: റിഖാഅ് (A) vs രിഖാഅ് (B). First consonant reads റ (leans A) but ര/റ is a held glyph call; HELD, not applied.
- [ ] pdf p24: idx11-15 (and idx12 empty A) block 2 arabic poem lines (Khandaq poems): print has no separator character between hemistichs, only a wide blank gap. A has "...", B has "/". Neither matches; "..." left in place, flag for user. idx16 separator likewise (print gap); letters corrected to ة.
- [ ] pdf p35: HELD block 3 idx23 സഇൗദുബ്നു (A) vs സഈദുബ്നു (B): ഇൗ vs ഈ vowel glyph not decidable at this resolution; not applied
- [ ] pdf p35: HELD block 8 idx26 അബൂസഇൗദിനിൽ (A) vs അബൂസഈദിനിൽ (B): ഇൗ vs ഈ vowel glyph not decidable; not applied
- [ ] pdf p38: HELD block 1 idx28 അധ്യായം (A) vs അദ്ധ്യായം (B): doubling of ദ്ധ not decidable at this resolution; not applied
- [ ] pdf p41: HELD block 4 idx31 ഉഛത്തിൽ (A) vs ഉച്ചത്തിൽ (B): print at this spot reads neither cleanly (consonant cluster after ഉ not decidable); not applied; neither reading confirmed
- [ ] pdf p43: HELD block 3 idx34 ഇന്നുവരെക്കും (A) vs ഇന്നുവരേക്കും (B): vowel sign after ര (െ vs േ) not decidable; not applied
- [ ] pdf p44: HELD block 0 idx35 والله (A) vs ووالله (B): extra waw in 'وَوَاللَّهِ لَا أَكْذِبُ' could not be isolated reliably at native resolution after repeated crops; not applied
- [ ] pdf p47: HELD block 3 idx37 كدى (A) vs كدي (B): final ى vs ي (dots) at 'كُدَيٌ' not clearly resolvable at this crop; not applied
- [ ] pdf p51: HELD block 0 idx39 'കഅ്ബം' (A, before 'റസൂൽ(സ) കടന്നുവരികയും') vs nothing (B): print seems to have no കഅ്ബം there, but line-boundary layout not verified; not applied
- [ ] pdf p51: HELD block 0 idx40 'കഅ്ബാലയത്തിനു' (A) vs 'കഅ്ബം' (B) after 'ചുംബിച്ച ശേഷം': print line ends 'ശേഷം കഅ്ബം' (B visible) but word wrap with next line not fully verified; not applied
- [ ] pdf p51: HELD block 0 idx41 'കഅ്ബയുടെ' (A) vs 'കഅ്ബാലയത്തിനു' (B) after 'അങ്ങനെ റസൂൽ(സ)': line order at crop boundary not verified; not applied
- [ ] pdf p52: HELD block 1 idx43 അബ്ദിൽമുത്വലിബ്(റ) (A) vs അബ്ദിൽമുത്ത്വലിബ്(റ) (B): print looks like മുത്ത്വല but ത്ത്വ vs ത്വ is glyph-level; not applied
- [ ] pdf p54: HELD block 3 idx44 മുതീഅ്(റ) (A) vs മുത്വീഅ്(റ) (B): print glyph after മുത appears to be ്വ but ത്വ vs ത is glyph-level; not applied
- [ ] pdf p55: HELD block 1 idx45 അബ്ദിൽമുത്വലിബിന്റെ (A) vs അബ്ദിൽമുത്ത്വലിബിന്റെ (B): print looks like മുത്ത്വലി but ത്ത്വ vs ത്വ is glyph-level; not applied
- [ ] pdf p62: HELD block 0 idx50 (പാപ്മോചന (A) vs (പാപമോചന (B): virama after പ not certain at the crop edge; not applied
- [ ] pdf p63: HELD (glyph-level, not applied): idx52 ML 'സന്ദര' (A) vs 'സൻദറ' (B) in block 0 - chillu ൻ vs ന് ; print looks like chillu but not certain
- [ ] pdf p63: HELD (glyph-level, not applied): idx53 ML 'വിച്ഛേദിച്ച്' (A) vs 'വിഛേദിച്ച്' (B) in block 0 - ച്ഛ conjunct vs ഛ; not decidable at this resolution
- [ ] pdf p64: HELD (glyph-level, not applied): idx55 ML 'ഔതാസിലേക്കയച്ചു' (A) vs 'ഔത്വാസിലേക്കയച്ചു' (B) in block 1 - ത്വ vs ത; ്വ looks present but not certain at native zoom
- [ ] pdf p65: HELD (glyph-level, not applied): idx57 ML 'മുത്തലിബ്(റ):' (A) vs 'മുത്ത്വലിബ്(റ):' (B) block 1 - ത്വ vs ത
- [ ] pdf p65: HELD (glyph-level, not applied): idx59 ML 'മുത്തലിബ്(റ)വും' (A) vs 'മുത്ത്വലിബ്(റ)വും' (B) block 1 - ത്വ vs ത (same word also at line 1, not applied)
- [ ] pdf p65: HELD (glyph-level, not applied): idx61 ML 'അൻസാറുകളെ' (A) vs 'അൻസ്വാറുകളെ' (B) block 1 - ്വ vs none
- [ ] pdf p66: HELD (glyph-level, not applied): idx67 ML 'അബ്ദുൽമുത്തലിബിന്റെ' (A) vs 'അബ്ദുൽമുത്ത്വലിബിന്റെ' (B) block 2 - ്വ
- [ ] pdf p68: HELD (glyph-level, not applied): idx72 ML 'അബൂബകർ(റ):' (A) vs 'അബൂബക്റഃ(റ):' (B) block 1 - ർ vs ്റഃ; print looks like ക്റഃ but not certain
- [ ] pdf p68: HELD (glyph-level, not applied): idx73 ML 'മനഃപൂർവ്വം' (A) vs 'മനഃപ്പൂർവ്വം' (B) block 1 - gemination പ്പ; print looks doubled but not certain
- [ ] pdf p68: HELD (glyph-level, not applied): idx74 ML 'അബൂബകർ(റ)' (A) vs 'അബൂബക്റഃ(റ)' (B) block 3 - ർ vs ്റഃ
- [ ] pdf p68: HELD (glyph-level, not applied): idx75 ML '(അബൂബകർ) കൂറേ' (A) vs '(അബൂബക്റഃ) കുറേ' (B) block 3 - ർ/റ and ൂ/ു
- [ ] pdf p68: HELD (glyph-level, not applied): idx76 ML 'മൂന്നാമനാണ് ദേഹം.' (A) vs 'മൂന്നാമനാണദ്ദേഹം.' (B) block 3 - gemination ദ്ദ; print looks doubled but not certain
- [ ] pdf p69: HELD (not applied): idx79 ML 'തൃപ്തിപ്പെടുന്നില്ലയോ?"' (A) vs 'തൃപ്തിപ്പെടുന്നില്ലെയോ?"' (B) block 1 - vowel sign െ not certain at native zoom
- [ ] pdf p69: HELD (glyph-level, not applied): idx80 ML 'ബനുജദീമയിലേക്കയച്ചു' (A) vs 'ബനൂജദീമയിലേക്കയച്ചു' (B) block 4 - ു vs ൂ
- [ ] pdf p70: NOT LOCATED/UNDECIDED: idx82 AR 'القرآن؟' (A) vs 'القرآن:' (B) block 1 - punctuation after القرآن could not be read at zoom; re-check
- [ ] pdf p70: HELD (glyph-level, not applied): idx83 ML 'അൻസാരികളിൽ' (A) vs 'അൻസ്വാരികളിൽ' (B) block 0 - ്വ
- [ ] pdf p70: HELD (glyph-level, not applied): idx84 ML '(ഗവർണർമാരായി)' (A) vs '(ഗവർണ്ണർമാരായി)' (B) block 2 - gemination ണ്ണ
- [ ] pdf p70: HELD (not applied): idx85-89 ML 'മേഘല' (A) vs 'മേഖല' (B) block 2 (5 occurrences: മേഘലകളിലേക്കാണ്, മേഘലകളായിരുന്നു, മേഘലയിലേക്ക്, മേഘലയിൽ x2). Print letter looks like ഘ but ഘ/ഖ not certain at native zoom
- [ ] pdf p72: HELD (glyph-level, not applied): idx95 ML 'അബീതാലിബ്(റ)' (A) vs 'അബീത്വാലിബ്(റ)' (B) block 1 - ്വ
- [ ] pdf p72: HELD (not applied): idx96 ML 'അസം സ്കൃത സർണ്ണം' (A) vs 'അസംസ്കൃത സ്വർണ്ണം' (B) block 1 - the line-wrap join 'അസംസ്കൃത' looks right, but 'സർണ്ണം' vs 'സ്വർണ്ണം' is a ്വ call; held as a whole
- [ ] pdf p72: HELD (glyph-level, not applied): idx97 ML 'ഹിസ്ൻ(റ),' (A) vs 'ഹിസ്ന്(റ),' (B) block 1 - chillu ൻ vs ന്
- [ ] pdf p72: HELD (glyph-level, not applied): idx98 ML 'നിസ്കാരക്കാരുണ്ട്.' (A) vs 'നിസ്ക്കാരക്കാരുണ്ട്.' (B) block 1 - consonant gemination ക്ക
- [ ] pdf p72: HELD (glyph-level, not applied): idx99 ML 'ദുൽഖലസ' (A) vs 'ദുൽഖലസ്വ' (B) block 2 (bab heading) - ്വ
- [ ] pdf p73: HELD (not applied): idx100 AR 'في' (A) vs 'فني' (B) block 3 (hadith 139, 'ببعض الطريق في/فني الزاد') - dot pattern not resolved at native zoom
- [ ] pdf p73: HELD (glyph-level, not applied): idx102 ML 'ദുകലാഅ്, ദുഅംറ്' (A) vs 'ദൂകലാഅ്, ദൂഅംറ്' (B) block 3 - ു vs ൂ
- [ ] pdf p73: HELD (glyph-level, not applied): idx103 ML 'ദുഅംറ്' (A) vs 'ദൂഅംറ്' (B) block 3 - ു vs ൂ
- [ ] pdf p74: HELD (glyph-level, not applied): idx105 ML 'അബൂഉബൈദ(റ)' (A) vs 'അബുഉബൈദ(റ)' (B) - block 0 (3 occurrences) and block 2 - ൂ vs ു
- [ ] pdf p75: HELD (glyph-level, not applied): idx108 and idx109 ML 'ചെയ്യുകയാണെങ്കിൽ' (A) vs 'ചെയ്യുകയാണെങ്കൽ' (B) block 2 (3 occurrences each) - chillu ൽ vs ിൽ
- [ ] pdf p75: NOTE (not a diff item, not changed): block 1 reads 'مَا عِنْدَكَ يَا ثُمَامَةُ' where print shows 'مَاذَا عِنْدَكَ' in both places
- [ ] pdf p76: HELD (not applied): idx111 ML '"മുമ്പതന്നെ' (A) vs '"മുമ്പ്തന്നെ' (B) block 2 - virama on മ്പ not certain at native zoom
- [ ] pdf p76: HELD (glyph-level, not applied): idx110 ML 'സാബിതുബ്നു വൈസുബ്നു' (A) vs 'സാബിതുബ്നു ഖൈസുബ്നു' (B) block 2 - വ vs ഖ not certain at native zoom (p80 print of the same name looked like വൈസേ)
- [ ] pdf p78: HELD (glyph-level, not applied): idx114 ML 'ഹജ്ജതുൽ' (A) vs 'ഹജ്ജത്തുൽ' (B) - bab heading block 4 and block 8 ('ഹജ്ജതുൽവദാഅ്') - gemination ത്ത
- [ ] pdf p80: HELD (not applied): idx115 ML 'ബിലാൽ(റ) അബ്ദുല്ലാഹിബ്നു വൈസേ' (A) vs 'ഖൈസേ' (B) block 1 - print looked like വൈസേ at zoom; Arabic name suggests ഖൈസ്; not decided
- [ ] pdf p85: NOT DECIDED: idx117 ML 'പ്രായചശ്ചിത്തമായി' (A) vs 'പ്രായശ്ചിത്തമായി' (B) block 0 - word not read at native zoom
- [ ] pdf p87: NOT DECIDED: idx118 ML 'വരേയുളളതിൽ' (A) vs 'വരെയുളളതിൽ' (B) block (line 'പ്രസവിച്ച ദിവസം മുതൽ ഇന്നു വരേയുളളതിൽ') - not located at zoom
- [ ] pdf p88: NOT DECIDED: idx119 ML 'പതിനോഴ്' (A) vs 'പതിനേഴ്' (B) block 3 (Arabic 'سبع عشرة' suggests 17) - word not located at zoom
- [ ] pdf p89: HELD (glyph-level, not applied): idx120 ML 'ലഭിച്ചുവെന്ന' (A) vs 'ലഭിച്ചുവെന്ന്' (B) block 5 - chillu ന്
- [ ] pdf p90: HELD (glyph-level, not applied): idx121 ML 'അബ്ദുൽമുത്വലിബ്' (A) vs 'അബ്ദുൽമുത്ത്വലിബ്' (B) block 8 - ്വ
- [ ] pdf p91: HELD (glyph-level, not applied): idx122 ML 'വസ്വിയ്യത്ത്' (A) vs 'വസിയ്യത്ത്' (B) block 0 - ്വ
- [ ] pdf p92: HELD (glyph-level, not applied): idx123 ML 'ഫാതിമ(റ)' (A) vs 'ഫാത്വിമ(റ)' (B) block 1 - ്വ


## Not adjudicated

- 4.1 pdf p1-25: Opus reading only (no Sonnet reading, by choice). Not diffed. Spot-check against the scan.
- 4.3 pdf p63-75: re-read from the scan. Adjudicated, but not second-read at high zoom.
- 4.3 pdf p85, p87-92: diffs not decided (not located at zoom). Use the Sonnet/Opus texts as read; check the scan.

