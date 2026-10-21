# Verification status (2026-10-11)

DB: 8,493 hadith (8,476 cite at least one of the six collections and were compared; 17 cite none).

## Arabic text (8,476 compared)
| status | hadith |
|---|---|
| A. confirmed word for word by 3 independent sources (sunnah dataset + OpenITI Jawami' al-Kalim + Shamela), or corrected | 6,245 |
| B. differences found, each reviewed and judged equivalent / a legitimate variant | 425 |
| C. difference not yet decided | 1 |
| D. differences of another kind (words omitted/added by the book, 3+ words) - NOT reviewed | 1,770 |
| E. cut off at page edge (36), needs a human (4675, 580), scan not checked (2) | ~35 |
Corrections applied: 191+ hadith (originals kept in hadiths.arabic_printed, reason in correction_note).

## Collection and number (match to the standard collections)
- >=75% word overlap with one collection: ~7,877 hadith; the 94 sampled all had the right collection+number.
- <75% overlap: 599 hadith; 3 of 40 sampled were wrong -> do not show numbers for these.
- 177 hadith have several equally good numbers (duplicates in the collection).
- Numbers are NOT displayed in the app yet.

## Narrator
- 3,046 agree with the narrator named in the collection; 591 differ (many are the book's convention of naming the tabi'i); 1,872 could not be checked (name not in our table); 213 collection gives no narrator.

## Malayalam translation  (largest open risk)
- Only 138 hadith + a 120-hadith sample compared with the Arabic.
- 138 changed-Arabic hadith: 89 faithful, 49 with mismatches (76 issues; 70 translation errors in the book, 6 caused by Arabic corrections).
- 120-sample audit: 12 wrong (10%), 36 minor issues (30%).
- Not yet checked: ~8,300 hadith.

## Files
data/verify/: arabic_final_status.csv, arabic_not_confirmed.csv, corrections_applied*.json, malayalam_mismatches_138.csv, narrator_differ.csv, unmatched.csv, hadeethenc/, audit_sample_120.json
