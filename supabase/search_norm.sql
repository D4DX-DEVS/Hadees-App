-- Malayalam search normalisation: the print uses variant spellings/encodings for the same word
-- (ഇൗ for ഈ, ബ്വ drawn for ബ്ബ, old-style chillus, split vowel signs ...). Search on a normalised copy.
create or replace function ml_norm(t text) returns text language sql immutable as $$
  select btrim(
    replace(                                                      -- ബ്വ -> ബ്ബ  (അബ്വാസ് -> അബ്ബാസ്)
    replace(replace(replace(                                       -- ളള / റ്റ / ൻമ old forms
    replace(replace(replace(                                       -- split vowel signs
    replace(replace(replace(replace(                               -- ഇൗ ഈൗ ഉൗ ഒൗ
    replace(replace(replace(replace(replace(                       -- old-style chillus (consonant + virama + ZWJ)
      coalesce(t, ''),
      E'ണ്‍', E'ൺ'),
      E'ന്‍', E'ൻ'),
      E'ര്‍', E'ർ'),
      E'ല്‍', E'ൽ'),
      E'ള്‍', E'ൾ'),
      E'ഈൗ', E'ഈ'),
      E'ഇൗ', E'ഈ'),
      E'ഉൗ', E'ഊ'),
      E'ഒൗ', E'ഔ'),
      E'ൊ', E'ൊ'),
      E'ോ', E'ോ'),
      E'ൌ', E'ൌ'),
      E'ളള', E'ള്ള'),
      E'ററ', E'റ്റ'),
      E'ൻമ', E'ന്മ'),
      E'ബ്വ', E'ബ്ബ')
  );
$$;
-- zero-width joiners/non-joiners removed last (after the chillu step above)
create or replace function ml_search_key(t text) returns text language sql immutable as $$
  select replace(replace(public.ml_norm(t), E'‌', ''), E'‍', '');
$$;

alter table hadiths add column if not exists malayalam_search text;
alter table hadiths add column if not exists narrator_search text;
create or replace function hadiths_before_write() returns trigger
language plpgsql as $$
begin
  new.arabic_plain := strip_harakat(new.arabic_text);
  new.malayalam_search := ml_search_key(new.malayalam_text);
  new.narrator_search := ml_search_key(new.narrator_ml);
  new.updated_at := now();
  return new;
end $$;
create index if not exists hadiths_ml_search_trgm on hadiths using gin (malayalam_search gin_trgm_ops);
create index if not exists hadiths_narrator_search_idx on hadiths (narrator_search);

create or replace function search_hadiths(q text, lim int default 50)
returns setof hadiths language sql stable as $$
  select * from hadiths
  where malayalam_search ilike '%' || ml_search_key(q) || '%'
     or malayalam_text   ilike '%' || q || '%'
     or arabic_plain     ilike '%' || strip_harakat(q) || '%'
  order by book_id, hadith_no
  limit lim
$$;
grant execute on function ml_norm(text), ml_search_key(text), search_hadiths(text,int) to anon, authenticated;
