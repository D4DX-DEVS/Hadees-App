-- Narrator biographies (from the book's article "ചില പ്രധാന ഹദീസ് നിവേദകർ") linked to hadith.
create table if not exists narrators (
  id          int primary key,                 -- number in the article (1..82)
  name_ml     text not null,                   -- as printed, without the trailing (റ)
  bio_ml      text not null,
  page        int,
  article_id  int references articles(id) on delete set null
);
-- every spelling of a narrator name found in hadiths.narrator_ml -> narrator
create table if not exists narrator_spellings (
  spelling     text primary key,               -- exactly as in hadiths.narrator_ml
  narrator_id  int not null references narrators(id) on delete cascade
);
create index if not exists narrator_spellings_nid on narrator_spellings(narrator_id);
create index if not exists hadiths_narrator_ml_idx on hadiths(narrator_ml);

alter table narrators enable row level security;
alter table narrator_spellings enable row level security;
drop policy if exists narrators_read on narrators;
create policy narrators_read on narrators for select using (true);
drop policy if exists narrator_spellings_read on narrator_spellings;
create policy narrator_spellings_read on narrator_spellings for select using (true);

create or replace view narrator_stats as
select n.id, n.name_ml, n.bio_ml, n.page,
       (select count(*) from hadiths h join narrator_spellings s on s.spelling = h.narrator_ml where s.narrator_id = n.id)::int as hadith_count
from narrators n;

-- hadith narrated by one narrator (all spellings), in book order
create or replace function narrator_hadiths(nid int, lim int default 30, off int default 0)
returns table (
  id int, book_id int, chapter_id int, hadith_no int, hadith_label text,
  arabic_text text, malayalam_text text, narrator_ml text, narrator_ar text,
  source_codes_ml text[], source_codes_ar text[], grading_note_ml text,
  volume_id smallint, book_no smallint, book_title_ml text,
  chapter_no smallint, chapter_title_ml text, total bigint)
language sql stable as $$
  select h.id, h.book_id, h.chapter_id, h.hadith_no, h.hadith_label,
         h.arabic_text, h.malayalam_text, h.narrator_ml, h.narrator_ar,
         h.source_codes_ml, h.source_codes_ar, h.grading_note_ml,
         b.volume_id, b.book_no, b.title_ml, c.chapter_no, c.title_ml,
         count(*) over () as total
  from hadiths h
  join narrator_spellings s on s.spelling = h.narrator_ml and s.narrator_id = nid
  join books b on b.id = h.book_id
  left join chapters c on c.id = h.chapter_id
  order by b.volume_id, b.book_no, h.hadith_no
  limit lim offset off
$$;
grant select on narrator_stats to anon, authenticated;
grant execute on function narrator_hadiths(int,int,int) to anon, authenticated;

-- where the text comes from (shown under the biography); article_id lets the app open the source article
alter table narrators add column if not exists source_note text;
drop view if exists narrator_stats;
create view narrator_stats as
select n.id, n.name_ml, n.bio_ml, n.page, n.article_id, n.source_note,
       (select count(*) from hadiths h join narrator_spellings s on s.spelling = h.narrator_ml where s.narrator_id = n.id)::int as hadith_count
from narrators n;
grant select on narrator_stats to anon, authenticated;
