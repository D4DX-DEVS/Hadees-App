-- Search v2: relevance ranking, English synonym terms, space-insensitive narrator matching, suggestions.
--   sort  'relevance' (default) | 'book'
--   terms extra Malayalam/Arabic words to match in the text (client expands English words, e.g. fasting -> നോമ്പ്)
--   narr  extra narrator names to match (space-insensitive, narrator field only)
drop function if exists app_search(text, int, int, text, int, int);
drop function if exists app_search(text, int, int, text, int, int, text, text[], text[]);
create or replace function app_search(
  q text, vol int default null, book int default null, src text default null,
  lim int default 30, off int default 0,
  sort text default 'relevance', terms text[] default '{}', narr text[] default '{}', ngroup text default null)
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
           public.strip_harakat(btrim(q)) as ak,
           replace(public.ml_search_key(btrim(q)), ' ', '') as mkn,
           array(select public.ml_search_key(t) from unnest(terms) t where btrim(t) <> '') as ks,
           array(select '%' || public.ml_search_key(t) || '%' from unnest(terms) t where btrim(t) <> '') as tp,
           array(select '%' || replace(public.ml_search_key(t), ' ', '') || '%' from unnest(narr) t where btrim(t) <> '') as np
  ), m as (
    select h.id, h.book_id, h.chapter_id, h.hadith_no, h.hadith_label,
           h.arabic_text, h.malayalam_text, h.narrator_ml, h.narrator_ar,
           h.source_codes_ml, h.source_codes_ar, h.grading_note_ml,
           b.volume_id, b.book_no, b.title_ml as book_title_ml,
           c.chapter_no, c.title_ml as chapter_title_ml,
           h.malayalam_search as ms, p.mk, p.ks, p.raw,
           (p.raw is not null and replace(h.narrator_search, ' ', '') ilike '%' || p.mkn || '%')
             or replace(h.narrator_search, ' ', '') ilike any (p.np) as narr_hit,
           (p.raw is not null and h.malayalam_search ilike '%' || p.mk || '%')
             or h.malayalam_search ilike any (p.tp) as ml_hit,
           (p.raw is not null and h.arabic_plain ilike '%' || p.ak || '%') as ar_hit,
           (select coalesce(sum((length(h.malayalam_search) - length(replace(h.malayalam_search, k, ''))) / length(k)), 0)
              from unnest(case when p.raw is null then p.ks else array[p.mk] || p.ks end) k where k <> '') as n_occ,
           (select bool_or(public.ml_search_key(c.title_ml) ilike '%' || k || '%')
              from unnest(case when p.raw is null then p.ks else array[p.mk] || p.ks end) k where k <> '') as title_hit
    from hadiths h
    join books b on b.id = h.book_id
    left join chapters c on c.id = h.chapter_id
    cross join p
    where (p.raw is not null or src is not null or book is not null or cardinality(narr) > 0 or ngroup is not null)
      and (vol  is null or b.volume_id = vol)
      and (book is null or h.book_id = book)
      and (src  is null or src = any(h.source_codes_ml) or src = any(h.source_codes_ar))
      and (ngroup is null or h.narrator_ml in (select spelling from narrator_groups where gkey = ngroup))
  ), r as (
    select m.*,
           greatest(
             case when narr_hit then 1.5 else 0 end,                      -- the narrator himself/herself
             case when ml_hit then 0.4 + 0.3 * least(n_occ, 4) / 4.0      -- how often + how dense in a short text
                                  + least(0.3, 20.0 * n_occ * length(mk) / greatest(length(ms), 1)) else 0 end
               + case when title_hit and (ml_hit or ar_hit) then 0.4 else 0 end,   -- the chapter is about it
             case when ar_hit then 0.7 + case when title_hit then 0.4 else 0 end else 0 end
           )::real as rk
    from m
    where (raw is null and cardinality(narr) = 0)          -- browse by source / book / narrator without a query
       or narr_hit or ml_hit or ar_hit
  )
  select r.id, r.book_id, r.chapter_id, r.hadith_no, r.hadith_label, r.arabic_text, r.malayalam_text,
         r.narrator_ml, r.narrator_ar, r.source_codes_ml, r.source_codes_ar, r.grading_note_ml,
         r.volume_id, r.book_no, r.book_title_ml, r.chapter_no, r.chapter_title_ml, r.rk, count(*) over ()
  from r
  order by (case when sort = 'book' then 0 else r.rk end) desc, r.volume_id, r.book_no, r.hadith_no
  limit lim offset off
$$;

-- typing suggestions: narrators (spellings merged), chapter titles, book titles
drop function if exists app_suggest(text, int);
create or replace function app_suggest(q text, lim int default 8)
returns table (kind text, label text, id int, n int, key text)
language sql stable as $$
  with k as (select public.ml_search_key(btrim(q)) as mk, replace(public.ml_search_key(btrim(q)), ' ', '') as mkn),
  nar as (
    select 'narrator'::text kind, max(g.label) label, null::int id, count(*)::int n, g.gkey key, 1 ord
    from hadiths h
    join narrator_groups g on g.spelling = h.narrator_ml
    cross join k
    where k.mkn <> '' and replace(h.narrator_search, ' ', '') ilike '%' || k.mkn || '%'
    group by g.gkey
    order by count(*) desc limit 4
  ), ch as (
    select 'chapter'::text, c.title_ml, c.id, c.hadith_count::int, null::text, 2
    from chapter_stats c, k
    where k.mk <> '' and public.ml_search_key(c.title_ml) ilike '%' || k.mk || '%'
    order by (public.ml_search_key(c.title_ml) ilike k.mk || '%') desc, c.hadith_count desc limit 4
  ), bk as (
    select 'book'::text, b.title_ml, b.id, b.hadith_count::int, null::text, 3
    from book_stats b, k
    where k.mk <> '' and public.ml_search_key(b.title_ml) ilike '%' || k.mk || '%'
    order by b.hadith_count desc limit 2
  )
  select kind, label, id, n, key from (select * from nar union all select * from ch union all select * from bk) u
  order by ord, n desc limit lim
$$;
grant execute on function app_search(text,int,int,text,int,int,text,text[],text[],text), app_suggest(text,int) to anon, authenticated;
