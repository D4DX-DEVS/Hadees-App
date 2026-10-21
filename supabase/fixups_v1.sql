-- Vol 1 manual fix-ups, run after the seed_1.*.sql files
-- Book 11 #21: the book prints the number only (under بَابٌ: التَّبَرُّزُ فِي الْكَنِيفِ), no text
update hadiths h set arabic_text = '', arabic_plain = '', malayalam_text = '', needs_review = false,
       grading_note_ar = null,
       explanation_ml = 'ഗ്രന്ഥത്തിൽ ഈ നമ്പർ മാത്രം അച്ചടിച്ചിരിക്കുന്നു; ഹദീസ് വാചകം നൽകിയിട്ടില്ല.'
from books b where b.id = h.book_id and b.volume_id = 1 and b.book_no = 11 and h.hadith_no = 21;
