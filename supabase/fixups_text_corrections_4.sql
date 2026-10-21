-- 2026-10-11: print check of a random sample of small differences: dropped word "كل" (hadith 4696, Tirmidhi 271)
update hadiths set arabic_printed = coalesce(arabic_printed, arabic_text),
  arabic_text = replace(arabic_text, 'عَلَى مَا كَانَ فِيكَ', 'عَلَى كُلِّ مَا كَانَ فِيكَ'),
  correction_note = coalesce(correction_note || '; ', '') || 'OCR: dropped كل (print: على كل ما كان فيك)'
where id = 4696 and arabic_text like '%عَلَى مَا كَانَ فِيكَ%';
select id, (length(arabic_text) - length(replace(arabic_text,'عَلَى كُلِّ مَا كَانَ فِيكَ','')))/length('عَلَى كُلِّ مَا كَانَ فِيكَ') as n from hadiths where id = 4696;
