-- docs/verify_counts.sql: run in the SQL editor after the migration
select b.volume_id as vol, b.book_no as book, b.title_ml,
       (select count(*) from hadiths h where h.book_id = b.id) as hadith,
       (select count(*) from hadith_embeddings e join hadiths h on h.id = e.hadith_id where h.book_id = b.id) as embedded,
       (select count(*) from hadiths h where h.book_id = b.id and h.needs_review) as flagged
from books b
where exists (select 1 from hadiths h where h.book_id = b.id) or b.book_no in (1,2,20)
order by 1, 2;
select count(*) as articles, (select count(*) from article_blocks) as article_blocks from articles;
