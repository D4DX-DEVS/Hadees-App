-- Arabic transcription errors found by proofreading flagged hadith against the printed pages (2026-10-11); each verified on the scan
update hadiths set arabic_text = replace(arabic_text, 'رَسُو لَ', 'رَسُولَ') where id = 15908 and arabic_text like '%رَسُو لَ%';
update hadiths set arabic_text = replace(arabic_text, 'حِزْبِي', 'جُزْئِي') where id = 16179 and arabic_text like '%حِزْبِي%';
update hadiths set arabic_text = replace(arabic_text, 'يَكُفَّ', 'يَكْفِتَ') where id = 17581 and arabic_text like '%يَكُفَّ%';
update hadiths set arabic_text = replace(arabic_text, 'يُغَذِّيَ', 'يُغْدِيَ') where id = 16411 and arabic_text like '%يُغَذِّيَ%';
update hadiths set arabic_text = replace(arabic_text, 'إِلَي الصَّلَاةِ', 'إِلَى الصَّلَاةِ') where id = 17427 and arabic_text like '%إِلَي الصَّلَاةِ%';
select id, position('جُزْئِي' in arabic_text) a, position('يُغْدِيَ' in arabic_text) b, position('يَكْفِتَ' in arabic_text) c, position('رَسُولَ اللهِ، أَيُّ' in arabic_text) d, position('إِلَى الصَّلَاةِ' in arabic_text) e from hadiths where id in (15908,16179,17581,16411,17427);
