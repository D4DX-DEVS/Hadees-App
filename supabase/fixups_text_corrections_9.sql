-- 2026-10-13, approved by the user after viewing the scans:
-- (1) vol 3 book 2 #98: the print shows a typesetting placeholder ◌ inside صَلَّى (twice) -> removed; original kept in arabic_printed.
-- (2) vol 3 book 14 #177: the print has only "١٧٧. عَنِ" (matn and translation missing in the book) -> row removed (backup: backups/2026-10-13/v3_book14_hadith177.json).
begin;
update hadiths h set arabic_printed = coalesce(h.arabic_printed, h.arabic_text),
       arabic_text = replace(h.arabic_text, '◌', ''),
       correction_note = coalesce(h.correction_note || '; ', '') || 'typesetting placeholder ◌ in صَلَّى removed (print p73)'
  from books b where b.id = h.book_id and b.volume_id = 3 and b.book_no = 2 and h.hadith_no = 98 and h.arabic_text like '%◌%';
delete from hadiths h using books b where b.id = h.book_id and b.volume_id = 3 and b.book_no = 14 and h.hadith_no = 177 and h.arabic_text = 'عَنِ';
commit;
