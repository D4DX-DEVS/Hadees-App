## p019-036 (hadith 55-111, 22 babs)
- #66 code printed "(ت جه)" (space, no comma) — build parser must accept
- starts_mid_word p020, p022; p035 ends mid-sentence #108 -> p036
- [?] p034 #103 ml two lines start covered by thumb: "ഐശ്വര്യവാനാക്കുന്നത് [?]ന്നതു കൊണ്ടു", "അല്ലെങ്കിൽ അത്ര [?] വരുന്ന സ്വർണ്ണം"
- uncertain: p029 #81 ഹുസ്വൈൻ; tilted p036/p035 end reordered by sense
- misprints kept: #56 وَأَسْمَنَهُ; #55 ml "അവന്റെ ആടുകൾ" in camel section; #85 ar father's name missing; #108 ഹകീമുബ്നു ഹിസാം vs حِزَام; #106 "സംഘമാളുകൾ"
## p091-106 (hadith 281-337, book end, 27 babs) — validator OK
- starts_mid_word p094, p099; stray lone "(ന)" after #327 "(തു)" kept; #308 ml omits third Friday
- #298 Quran ref ml "179" vs ar 79; code/name misprints kept (ഹുറൈറയ്റ, ...); ~20 ml typos
- uncertain: p094 bab "തുഛമായ"; #295 "ചിന്തപ്പെടുകയും" smudge; #299 نَفِدَ; #312 ബുറൈദ vowels; #306 فَزَارِية
- WARNING: agent says small kasras may still be missing in Arabic (found/fixed نِصْفِ x3) — spot-check Arabic harakat
## p055-072 (hadith 165-222, 16 babs) — validator OK
- starts_mid_word p057-059, p061; p067-070 open with ar tail; p072 ends mid-word -> p073 starts mid-word; footnote p063 (* in #194)
- #219 verse 3 lines joined with \n
- uncertain: #216 نُعَيْمُ smudged; #203 فَاسْأَلْهُ; #194/195 تَرُدُّهُ; #222 الْأَقْرَعِ; #182 grading "[قَالَ الترمذي…"
- WARNING: agent may have silently normalised Sakat/Sakath spelling variants in Malayalam — spot-check p066, p070
- misprints kept: p057 bab مَا لاَ يُوجَزُ; #173 أَزُقٌ; #174 عُمَرُ بْنِ; #221 اللهم; ~12 ml typos
## p073-090 (hadith 223-280, 23 babs) — validator OK
- starts_mid_word p073, p083, p086, p087; ar tails p077(#234) p082(#248) p084(#257) p085(#261); footnote p090 (¹ Barira wala')
- #264 (خ) printed on own line below, kept; #276 ml says ദാനം where ar هدية (book's choice); #259 يَتَقَبَّلُ as printed
- uncertain: #263 ml damaged word "അവിടെ"; #249 dashes around وَفِي رِوَايَةٍ reconstructed; #266 تُصَرِّرَانِ نَفِسْنَاهُ تُلْمِعُ; #269 آتِي بِبَدَلِهَا
- ~25 ml typos kept; encoding ZWNJ in മുസ്‌ലിം ഹദ്‌യ
## p037-054 (hadith 112-164) — validator warns (expected)
- *** SCAN MISSING printed pages 190-191 (jumps 189->192 between p045 and p046). Hadith #127 breaks mid-sentence; #128-#131 and start of #132 are MISSING from the PDF. Need rescan of printed pp. 190-191 ***
- *** pdf page 18 (printed 162?) NOT transcribed (agent killed by API content filter) ***
- #133 (Abu Dawud, Abdullah ibn Mu'awiya al-Ghadiri "ثلاث من فعلهن…") printed with no number; stored as note blocks on p046-047; camel-age terms passage p043-044 also note blocks (not stored by build.py)
- p044, p046, p048 scanned sideways/upside-down (agent rotated); staggered ml reordered on many pages
- #121 grading printed "(جه) (في سنده ضعيف)" in round brackets; #155 Arabic "ما شاء الله" inside ml block (as printed); #115 ml spans p039-040, code (د) only on p040
- uncertain: #149 stray mark before "സമ്പത്തിലെ"; صَلَّى اللَّهُ عَلَيْهِ harakat written standard where not visible; p039 الرِّقَةِ
- misprints kept: الْإِبْلِ sukun (p037, p051 babs); #117 مِثْلَ قَبِيلٍ; p046 فَأَعْمَدُ x2; ml: ഹദൂസിലുള്ളത്, ഭൃത്ത്യനിലോ, തിരദൂതരോടും, അറുബത് സ്വാഅ്
## RECOVERED PAGES (user supplied "Vol 2 missing pages (190-191).pdf"): printed pp.190-191 → ocr/2.2/pages/p045a.json, p045b.json (Gemini, needs_review)
- adds hadith 128-133 and the missing chapter 49 heading; Zakat now complete: 337 hadith (1-337), 111 chapters
- pdf page 18 (hadith ~54/55) was also recovered by Gemini earlier
