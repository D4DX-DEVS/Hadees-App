-- Hadees Vijnanakosham (ഹദീസ് വിജ്ഞാനകോശം) — Supabase / Postgres schema
-- Hierarchy: volume → book (kitab) → chapter (bab) → hadith

create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- ───────── volumes ─────────
create table if not exists volumes (
  id          smallint primary key,            -- 1, 2, 3 ...
  title_ml    text not null,
  created_at  timestamptz not null default now()
);

-- ───────── books (കിതാബ്) ─────────
create table if not exists books (
  id          serial primary key,
  volume_id   smallint not null references volumes(id) on delete cascade,
  book_no     smallint not null,               -- number in the volume TOC (2 = നോമ്പ്)
  title_ml    text not null,
  title_ar    text,                            -- كِتَابُ الصَّوْمِ
  start_page  int,
  unique (volume_id, book_no)
);

-- ───────── chapters (ബാബ്) ─────────
create table if not exists chapters (
  id          serial primary key,
  book_id     int not null references books(id) on delete cascade,
  chapter_no  smallint not null,               -- number inside the book (TOC)
  title_ml    text not null,
  title_ar    text,                            -- بَابٌ: فَضْلُ الصِّيَامِ
  start_page  int,
  unique (book_id, chapter_no)
);
create index if not exists chapters_book_idx on chapters(book_id);

-- ───────── source collections (abbreviation legend) ─────────
create table if not exists sources (
  code_ar   text primary key,                  -- خ  م  ن  ت  د  جه ...
  code_ml   text not null unique,              -- ബു മു ന തു ദാ ജ ...
  name_en   text not null,
  name_ml   text,
  name_ar   text,
  verified  boolean not null default false     -- confirm against book's own legend
);

-- ───────── hadiths ─────────
create table if not exists hadiths (
  id                 serial primary key,
  book_id            int not null references books(id) on delete cascade,
  chapter_id         int references chapters(id) on delete set null,
  hadith_no          int not null,             -- printed number (١, ٢ ... ٣٧٤)
  arabic_text        text not null,            -- matn as printed, with harakat
  arabic_plain       text,                     -- harakat stripped (for search)
  malayalam_text     text not null,            -- meaning / translation as printed (പരിഭാഷ)
  narrator_ar        text,                     -- أَبِي هُرَيْرَةَ (from "عَنْ ...")
  narrator_ml        text,                     -- അബൂഹുറൈറ(റ)
  explanation_ml     text,                     -- commentary / notes (വിശദീകരണം), optional
  hadith_label       text,                     -- shown instead of hadith_no when the book prints no number (hadith_no >= 10001)
  group_id           int,                      -- same-hadith cluster (see hadith_relations)
  source_codes_ar    text[],                   -- {خ,ن}
  source_codes_ml    text[],                   -- {ബു,ന}
  grading_note_ar    text,                     -- [ز: في إسناده ضعيف]
  grading_note_ml    text,                     -- (സനദിൽ ദുർബലനുണ്ട്)
  page_start         int,
  page_end           int,
  needs_review       boolean not null default false,  -- OCR flagged [?]
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (book_id, hadith_no)
);
create index if not exists hadiths_narrator_idx on hadiths(narrator_ml);
create index if not exists hadiths_group_idx on hadiths(group_id);
create index if not exists hadiths_chapter_idx on hadiths(chapter_id);
create index if not exists hadiths_ml_trgm  on hadiths using gin (malayalam_text gin_trgm_ops);
create index if not exists hadiths_ar_trgm  on hadiths using gin (arabic_plain  gin_trgm_ops);
create index if not exists hadiths_src_idx  on hadiths using gin (source_codes_ar);

-- ───────── riwayah variants ("وفي رواية" / "മറ്റൊരു നിവേദനം") ─────────
create table if not exists hadith_variants (
  id           serial primary key,
  hadith_id    int not null references hadiths(id) on delete cascade,
  seq          smallint not null,              -- 1 = first "وفي رواية", 2 = second ...
  arabic_text  text,
  malayalam_text text,
  unique (hadith_id, seq)
);

-- ───────── same hadith under different numbers ─────────
create table if not exists hadith_relations (
  hadith_id   int not null references hadiths(id) on delete cascade,
  related_id  int not null references hadiths(id) on delete cascade,
  relation    text not null check (relation in ('duplicate','variant','partial')),
  score       real,                            -- trigram similarity of harakat-stripped Arabic
  verified    boolean not null default false,  -- human-confirmed
  primary key (hadith_id, related_id),
  check (hadith_id < related_id)
);

-- strip Arabic diacritics (tashkeel + tatweel) so search ignores harakat
create or replace function strip_harakat(t text) returns text
language sql immutable as $$
  select regexp_replace(t, '[ؐ-ًؚ-ٰٟۖ-ۭـ]', '', 'g')
$$;

create or replace function hadiths_before_write() returns trigger
language plpgsql as $$
begin
  new.arabic_plain := strip_harakat(new.arabic_text);
  new.updated_at   := now();
  return new;
end $$;

drop trigger if exists hadiths_bw on hadiths;
create trigger hadiths_bw before insert or update on hadiths
for each row execute function hadiths_before_write();

-- matn core: harakat-stripped Arabic minus stock formulae, isnad words, source codes, grading notes
create or replace function matn_core(t text) returns text language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(public.strip_harakat(t),
    '\[[^]]*\]|\([^)]*\)', ' ', 'g'),                                   -- codes / notes
    '\m(رضي الله عنه(ما|ا|م)?|صلى الله عليه وسلم|رسول الله|النبي|قال(ت)?|عن|سمعت|يقول|أن|إن|في|من)\M', ' ', 'g'),
    '[^\u0621-\u064A ]', ' ', 'g'),                                       -- punctuation
    '\s+', ' ', 'g'))
$$;
create index if not exists hadiths_matn_trgm on hadiths using gin (matn_core(arabic_text) gin_trgm_ops);

-- ───────── search RPC (call from app: supabase.rpc('search_hadiths', {q})) ─────────
create or replace function search_hadiths(q text, lim int default 50)
returns setof hadiths language sql stable as $$
  select * from hadiths
  where malayalam_text ilike '%' || q || '%'
     or arabic_plain   ilike '%' || strip_harakat(q) || '%'
  order by book_id, hadith_no
  limit lim
$$;

-- ───────── related hadiths for one hadith (both directions) ─────────
create or replace function related_hadiths(hid int)
returns table (id int, hadith_no int, relation text, score real) language sql stable as $$
  select h.id, h.hadith_no, r.relation, r.score
  from hadith_relations r
  join hadiths h on h.id = case when r.hadith_id = hid then r.related_id else r.hadith_id end
  where hid in (r.hadith_id, r.related_id)
  order by r.score desc
$$;

-- ───────── convenience view for rendering ─────────
create or replace view hadith_full as
select h.*, c.chapter_no, c.title_ml as chapter_title_ml, c.title_ar as chapter_title_ar,
       b.book_no, b.title_ml as book_title_ml, b.title_ar as book_title_ar, b.volume_id
from hadiths h
join books b on b.id = h.book_id
left join chapters c on c.id = h.chapter_id;

-- ───────── RLS: public read-only, writes via service role ─────────
alter table volumes  enable row level security;
alter table books    enable row level security;
alter table chapters enable row level security;
alter table sources  enable row level security;
alter table hadiths  enable row level security;
alter table hadith_variants  enable row level security;
alter table hadith_relations enable row level security;
do $$ begin
  create policy "public read" on volumes  for select using (true);
  create policy "public read" on books    for select using (true);
  create policy "public read" on chapters for select using (true);
  create policy "public read" on sources  for select using (true);
  create policy "public read" on hadiths  for select using (true);
  create policy "public read" on hadith_variants  for select using (true);
  create policy "public read" on hadith_relations for select using (true);
exception when duplicate_object then null; end $$;

-- ───────── seed: source legend (VERIFY against the book's abbreviation page) ─────────
insert into sources (code_ar, code_ml, name_en, name_ml, name_ar) values
  ('خ',  'ബു', 'Sahih al-Bukhari',  'ബുഖാരി',     'صحيح البخاري'),
  ('م',  'മു', 'Sahih Muslim',      'മുസ്ലിം',     'صحيح مسلم'),
  ('ن',  'ന',  'Sunan an-Nasa''i',  'നസാഈ',       'سنن النسائي'),
  ('ت',  'തു', 'Jami at-Tirmidhi',  'തുർമുദി',     'جامع الترمذي'),
  ('ق',  'ബു,മു', 'Muttafaq alayh (Bukhari & Muslim)', 'ബുഖാരി, മുസ്ലിം', 'متفق عليه'),
  ('د',  'ദ',  'Sunan Abi Dawud',   'അബൂദാവൂദ്',   'سنن أبي داود'),
  ('جه', 'ജ',  'Sunan Ibn Majah',   'ഇബ്നുമാജ',   'سنن ابن ماجه')
on conflict (code_ar) do nothing;
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
