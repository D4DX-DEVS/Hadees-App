## p091-106 (hadith 357-415, 25 babs) — validator OK
- PDF pages rotated for pdfimages (agent used pdftoppm); tilted ml reordered p095,097,101,102,103,105
- #415 cut at p106 end (ml on p107); p102 starts #399 ar tail, p104 starts #407 ar tail; p091 starts with ml tail of hadith from p090
- p097 has two consecutive babs: "أبواب النوم / ഉറക്കം" (section heading stored as bab) then "ينبطح على بطنه"  -> bab count vs index may be off by one
- uncertain: p099 bab ഏങ്ങോട്ട്/എ; #373 نطَعًا; #376 مِنِ; #403 أَفْضَلُ; #378 quote never closed; Arabic اللهُ vs اللَّهِ as seen
- ~20 ml typos kept
## p055-072 (hadith 213-285, 41 babs) — validator OK
- no starts_mid_word; p055 opens with #212 ar tail; p058(#225), p066(#255), p070(#273) start mid-Arabic
- staggered ml reordered by sense: p055(#215) p059(#231) p061(#236-238) p063(#247) p065(#252,254) p067(#263,264) p069(#270,272) — SPOT-CHECK
- #263 grading printed "في سنده ضعيف" without [ز: ] brackets (build regex won't catch)
- uncertain Arabic: #216 الْبَرَاءِ; هِرَقْل (#226); #272 مَجْلِسٍ أَوْ سُوقٍ; #249 يَا فَتًى; #257 مَنِ ادَّعَى/أَوِ انْتَمَى; #281 صَبُوبٍ; ml #281 അബൂഥുഫൈൽ (ത്വു?)
- misprints kept: #226 اللهم/عَنْهُم–/ദിവേദനത്തിൽ/ഹിർഖലിന് vs ഹിറഖലിന്; #236 no عَنْ; #248 عَنْهُمَا single person; #279 جابر بن سمرة
## p073-090 (hadith 286-356, 32 babs) — validator OK
- p087 scanned sideways (agent rotated); no starts_mid_word; #356 cut at p090 end -> p091 ml
- carry-overs: #303 p076→077, #322 p080→081, #326 p081→082, #337 p084→085, #341 p085→086, #353 p088→089, #355 p089→090; ml tops p075 p079 p083 p087
- codes as printed: #299 (ق ت) no comma; #323 (ബു,മ,…) മ for മു
- misprints kept: bab "بَابٌ لَا يُقَالُ"/"بَابٌ فِي قَتْلِ الذَّرِّ" no colon; #326 عَلَى بَابٌ; #335 حُمَّرَةً/الْحُمَرَةُ; #352 stray comma; #355 غَيْرَتَكَ; ~20 ml typos
- uncertain: #287 "إِلَّا مَا لَا" repetition; #296 عَنْهَا for Salama; p079 bab title; #326 ആദ്ദേഹം; long-line harakat #355
## p019-036 (hadith 71-140, 19 babs) — validator OK
- p031 scanned sideways (agent rotated); p019 opens with #70 ml tail; ar tails p032(#119) p033(#123) p034(only code (جه) of #128) p036(#138)
- p023 has section heading "أبواب السلام / സലാം പറയൽ" stored as book_heading block (build.py now treats non-first book_heading as a bab)
- code mismatch #128 ar (جه) vs ml (ബു); #73 مَنْ for مِنْ x3; tanween on الْبَابٌ (#75,76,117,137); ml: ഭാഗത്തുകുടെയോ, ഖൈസാണ്, അബു ഉബയ്യ്(റ), ദോശങ്ങൾ, നാല് (virama)
- uncertain: damma vs dammatan on several word-endings (2 fixed p021); #113 السَّلَامُ
## p037-054 (hadith 141-212, 40 babs) — validator OK
- pdf p040, p042, p048 rotated 90 (agent used pdftoppm); no starts_mid_word; #212 cut mid-Arabic at p054 end -> p055
- splits: #170 ar p044->p045; #173 ar ->p046; #198 ar ->p052; ml continues for #145,148,155,163,166,177,185,190
- bab "مَنْ يُؤْمَرُ أَنْ يُجَالَسَ" printed without colon
- uncertain Malayalam ു vs ൂ indistinguishable in this font (standard spelling used): അബൂ… names, തിരുദൂതർ, റസൂലേ, മൂന്ന്, അബൂമൂസാ (#169) vs അബൂമൂസ (#182)
- uncertain Arabic: #147/#156 بْن without kasra; #211 فَأَوَاهُ no madda; اللهُ vs اللَّهُ as visible
- misprints kept: #153 الْفِهْرِيَّ; #158 عِمْرَانِ; #177 اللَّهُم; #183 عَنَ; #147 عَنْهُمَا for Abu Sa'id; #199 قَعْدَةَ; ml: മനോവിശമമുണ്ടാക്കി, ജലദോശം, എഴുൽക്കുകയും, വകാശി, ഒഴിഞ്ഞുകെടുത്താൽ
## p001-018 (hadith 1-70, 22 babs) — validator: 1 expected warning
- #27 ar has no closing code on p008; continues on p009 as null block ending (خ,د) — correct as printed
- no starts_mid_word; #70 ml continues on p019; ar continuations #15 p004→005, #17 p005→006, #27 p008→009, #68 p017→018; 1 footnote p008 (*)
- scans only 144 dpi — long-matn harakat (#14,15,16,65,67,68) best reading; #40 grading "[ز: فيه رَاوٍ مجهول]" little vocalisation; #54 grading fully vocalised (best reading)
- misprints kept: #18 عُمَرَ بْنَ, جَلْجَتِنَا; #61 فِي بَابٌ; #63 عَلَى بَابٌ, الْبَابُ; #67 اللَّهم, السَّفْقُ; ml അദ്ദഹേം, റസൂര്(സ), കുടെ, മുന്ന്
