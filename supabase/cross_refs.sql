-- App-facing cross references between hadith (built on hadith_relations / hadiths.group_id)

-- one row per link, with both sides' book / chapter / number
create or replace view hadith_links as
select r.hadith_id, r.related_id, r.relation, r.score, r.verified,
       a.hadith_no  as a_no, ab.book_no as a_book, ab.title_ml as a_book_title,
       ac.chapter_no as a_chapter, ac.title_ml as a_chapter_title,
       b.hadith_no  as b_no, bb.book_no as b_book, bb.title_ml as b_book_title,
       bc.chapter_no as b_chapter, bc.title_ml as b_chapter_title,
       (a.book_id <> b.book_id) as cross_book
from hadith_relations r
join hadiths a  on a.id = r.hadith_id   join books ab on ab.id = a.book_id
left join chapters ac on ac.id = a.chapter_id
join hadiths b  on b.id = r.related_id  join books bb on bb.id = b.book_id
left join chapters bc on bc.id = b.chapter_id;

-- "other places this hadith appears": works from either side of a link
create or replace function cross_refs(hid int)
returns table (hadith_id int, hadith_no int, book_no smallint, book_title text,
               chapter_no smallint, chapter_title text, relation text, score real, cross_book boolean)
language sql stable as $$
  select h.id, h.hadith_no, b.book_no, b.title_ml, c.chapter_no, c.title_ml, r.relation, r.score, (h.book_id <> me.book_id)
  from hadith_relations r
  join hadiths me on me.id = hid
  join hadiths h  on h.id = case when r.hadith_id = hid then r.related_id else r.hadith_id end
  join books b on b.id = h.book_id
  left join chapters c on c.id = h.chapter_id
  where hid in (r.hadith_id, r.related_id)
  order by r.score desc, b.book_no, h.hadith_no
$$;

-- everything in the same duplicate/variant cluster (including itself)
create or replace function same_hadith_group(gid int)
returns table (hadith_id int, hadith_no int, book_no smallint, chapter_no smallint)
language sql stable as $$
  select h.id, h.hadith_no, b.book_no, c.chapter_no
  from hadiths h join books b on b.id = h.book_id left join chapters c on c.id = h.chapter_id
  where h.group_id = gid order by b.book_no, h.hadith_no
$$;

-- public read access for the app (views run with the caller's rights)
grant select on hadith_links to anon, authenticated;
grant execute on function cross_refs(int), same_hadith_group(int) to anon, authenticated;
