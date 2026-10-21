-- App-facing API for the Hadees Vijnanakosham app (read-only, anon role).
-- Run: supabase db query --linked -f supabase/app_api.sql

create extension if not exists vector;

-- ───────── list rows for the library / reader ─────────
grant select on hadith_full to anon, authenticated;

-- hadith counts per book (library screen)
create or replace view book_stats as
select b.id, b.volume_id, b.book_no, b.title_ml, b.title_ar, b.start_page,
       (select count(*) from hadiths h where h.book_id = b.id)::int  as hadith_count,
       (select count(*) from chapters c where c.book_id = b.id)::int as chapter_count
from books b;
grant select on book_stats to anon, authenticated;

-- hadith counts per chapter (book screen)
create or replace view chapter_stats as
select c.id, c.book_id, c.chapter_no, c.title_ml, c.title_ar, c.start_page,
       (select count(*) from hadiths h where h.chapter_id = c.id)::int as hadith_count,
       (select min(h.hadith_no) from hadiths h where h.chapter_id = c.id) as first_no,
       (select max(h.hadith_no) from hadiths h where h.chapter_id = c.id) as last_no
from chapters c;
grant select on chapter_stats to anon, authenticated;

-- ───────── keyword search with filters + ranking ─────────
-- q matches Malayalam (normalised), Arabic (harakat-insensitive) or narrator.
-- Returns hadith_full rows plus a rank; total via count(*) over().
create or replace function app_search(
  q text, vol int default null, book int default null, src text default null,
  lim int default 30, off int default 0)
returns table (
  id int, book_id int, chapter_id int, hadith_no int, hadith_label text,
  arabic_text text, malayalam_text text, narrator_ml text, narrator_ar text,
  source_codes_ml text[], source_codes_ar text[], grading_note_ml text,
  volume_id smallint, book_no smallint, book_title_ml text,
  chapter_no smallint, chapter_title_ml text, rank real, total bigint)
language sql stable as $$
  with p as (
    select nullif(btrim(q), '') as raw,
           public.ml_search_key(btrim(q)) as mk,
           public.strip_harakat(btrim(q)) as ak
  )
  select h.id, h.book_id, h.chapter_id, h.hadith_no, h.hadith_label,
         h.arabic_text, h.malayalam_text, h.narrator_ml, h.narrator_ar,
         h.source_codes_ml, h.source_codes_ar, h.grading_note_ml,
         b.volume_id, b.book_no, b.title_ml, c.chapter_no, c.title_ml,
         greatest(
           case when h.narrator_search ilike '%' || p.mk || '%' then 1.0 else 0 end,
           case when h.malayalam_search ilike '%' || p.mk || '%' then 0.8 + 0.2 * word_similarity(p.mk, h.malayalam_search) else 0 end,
           case when h.arabic_plain ilike '%' || p.ak || '%' then 0.8 + 0.2 * word_similarity(p.ak, h.arabic_plain) else 0 end
         )::real as rank,
         count(*) over () as total
  from hadiths h
  join books b on b.id = h.book_id
  left join chapters c on c.id = h.chapter_id
  cross join p
  where (p.raw is not null or src is not null or book is not null)   -- browse by source/book without a query
    and (vol  is null or b.volume_id = vol)
    and (book is null or h.book_id = book)
    and (src  is null or src = any(h.source_codes_ml) or src = any(h.source_codes_ar))
    and (   h.malayalam_search ilike '%' || p.mk || '%'
         or h.arabic_plain     ilike '%' || p.ak || '%'
         or h.narrator_search  ilike '%' || p.mk || '%')
  order by rank desc, b.volume_id, b.book_no, h.hadith_no
  limit lim offset off
$$;

-- book / chapter titles matching q (shown above hadith results)
create or replace function app_search_titles(q text, lim int default 8)
returns table (kind text, id int, book_id int, volume_id smallint, book_no smallint,
               chapter_no smallint, title_ml text, title_ar text)
language sql stable as $$
  select 'book', b.id, b.id, b.volume_id, b.book_no, null::smallint, b.title_ml, b.title_ar
  from books b
  where public.ml_search_key(b.title_ml) ilike '%' || public.ml_search_key(q) || '%'
     or public.strip_harakat(coalesce(b.title_ar, '')) ilike '%' || public.strip_harakat(q) || '%'
  union all
  select 'chapter', c.id, c.book_id, b.volume_id, b.book_no, c.chapter_no, c.title_ml, c.title_ar
  from chapters c join books b on b.id = c.book_id
  where public.ml_search_key(c.title_ml) ilike '%' || public.ml_search_key(q) || '%'
     or public.strip_harakat(coalesce(c.title_ar, '')) ilike '%' || public.strip_harakat(q) || '%'
  limit lim
$$;

-- deterministic "hadith of the day"
create or replace function hadith_of_day(d date default current_date)
returns setof hadith_full language sql stable as $$
  select * from hadith_full
  where length(malayalam_text) between 120 and 600
  order by md5(id::text || d::text)
  limit 1
$$;

-- ───────── semantic search (pgvector) ─────────
-- one row per hadith; embedding of "chapter title + malayalam + arabic" (bge-m3, 1024 dims)
create table if not exists hadith_embeddings (
  hadith_id  int primary key references hadiths(id) on delete cascade,
  model      text not null,
  embedding  vector(1024) not null,
  updated_at timestamptz not null default now()
);
create index if not exists hadith_embeddings_hnsw
  on hadith_embeddings using hnsw (embedding vector_cosine_ops);
alter table hadith_embeddings enable row level security;   -- no public policy: only via RPC below

create or replace function match_hadiths(query_embedding vector(1024), k int default 12,
                                         vol int default null, min_sim real default 0.3)
returns table (
  id int, book_id int, hadith_no int, hadith_label text,
  arabic_text text, malayalam_text text, narrator_ml text, source_codes_ml text[],
  volume_id smallint, book_no smallint, book_title_ml text,
  chapter_no smallint, chapter_title_ml text, similarity real)
language sql stable security definer set search_path = public as $$
  select h.id, h.book_id, h.hadith_no, h.hadith_label,
         h.arabic_text, h.malayalam_text, h.narrator_ml, h.source_codes_ml,
         b.volume_id, b.book_no, b.title_ml, c.chapter_no, c.title_ml,
         (1 - (e.embedding <=> query_embedding))::real as similarity
  from hadith_embeddings e
  join hadiths h on h.id = e.hadith_id
  join books b on b.id = h.book_id
  left join chapters c on c.id = h.chapter_id
  where (vol is null or b.volume_id = vol)
    and 1 - (e.embedding <=> query_embedding) >= min_sim
  order by e.embedding <=> query_embedding
  limit k
$$;

grant execute on function app_search(text,int,int,text,int,int), app_search_titles(text,int),
  hadith_of_day(date) to anon, authenticated;
grant execute on function match_hadiths(vector,int,int,real) to anon, authenticated;

-- ───────── embedding backfill helpers (service role only; used by worker /admin/embed) ─────────
create or replace function hadiths_to_embed(lim int default 200)
returns table (id int, text text) language sql stable as $$
  select h.id,
         left(concat_ws(E'\n', b.title_ml || coalesce(' › ' || c.title_ml, ''),
                        h.narrator_ml, h.malayalam_text, h.arabic_plain), 3000)
  from hadiths h join books b on b.id = h.book_id left join chapters c on c.id = h.chapter_id
  where not exists (select 1 from hadith_embeddings e where e.hadith_id = h.id)
  order by h.id limit lim
$$;
create or replace function embeddings_remaining()
returns table (remaining bigint) language sql stable as $$
  select count(*) from hadiths h where not exists (select 1 from hadith_embeddings e where e.hadith_id = h.id)
$$;
revoke execute on function hadiths_to_embed(int), embeddings_remaining() from public, anon, authenticated;
grant execute on function hadiths_to_embed(int), embeddings_remaining() to service_role;

-- ───────── richer cross references for the app (volume, kitab, bab, snippet) ─────────
create or replace function app_cross_refs(hid int)
returns table (
  hadith_id int, hadith_no int, hadith_label text, volume_id smallint, book_id int, book_no smallint, book_title text,
  chapter_id int, chapter_no smallint, chapter_title text, relation text, score real, cross_book boolean,
  narrator_ml text, snippet text, source_codes_ml text[])
language sql stable as $$
  select h.id, h.hadith_no, h.hadith_label, b.volume_id, b.id, b.book_no, b.title_ml,
         c.id, c.chapter_no, c.title_ml, r.relation, r.score, (h.book_id <> me.book_id),
         h.narrator_ml, left(h.malayalam_text, 220), h.source_codes_ml
  from hadith_relations r
  join hadiths me on me.id = hid
  join hadiths h  on h.id = case when r.hadith_id = hid then r.related_id else r.hadith_id end
  join books b on b.id = h.book_id
  left join chapters c on c.id = h.chapter_id
  where hid in (r.hadith_id, r.related_id)
  order by (h.book_id <> me.book_id), r.score desc, b.volume_id, b.book_no, h.hadith_no
$$;
grant execute on function app_cross_refs(int) to anon, authenticated;
