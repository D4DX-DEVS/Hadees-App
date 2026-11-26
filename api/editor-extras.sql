-- Editor admin page, part 2: translations (English / Urdu / Malayalam), topics, and corrections of the extra libraries
-- (Sunnah.com = schema `sunnah`, iHadis = schema `ihadis`). Run ONCE as the database OWNER, after editor-role.sql:
--   psql -h /var/run/postgresql -U hadithencyclo_hadithencyclo -d hadithencyclo_hadees -f editor-extras.sql
-- Safe to run again.
--
-- Every hadith is named by one text key, `ref`:
--   h:<id>                      a hadith of this encyclopedia (public.hadiths.id)
--   s:<urn>                     a Sunnah.com hadith (sunnah.hadiths.urn)
--   i:<book_slug>/<hadith_id>   an iHadis hadith (ihadis.hadiths, all languages of it)
-- These tables live in `public`, so re-importing sources-bundle/ (which drops and re-creates the sunnah / ihadis
-- schemas) never removes the editor's work.

-- ───────── translations + corrections ─────────
-- One row per hadith and language. For an encyclopedia hadith: an added translation (en, ur).
-- For a Sunnah.com / iHadis hadith: an added translation (ml, ur, en), or a corrected text that replaces the imported one
-- wherever the editor's version is shown (en = English text, ar = Arabic text).
create table if not exists hadith_texts (
  id          serial primary key,
  ref         text not null check (ref ~ '^(h:[0-9]{1,9}|s:[A-Za-z0-9:._-]{1,120}|i:[A-Za-z0-9._-]{1,80}/[A-Za-z0-9._-]{1,40})$'),
  lang        text not null check (lang in ('en', 'ur', 'ml', 'ar')),
  body        text not null,
  narrator    text,
  note        text,                                  -- e.g. who translated it, or why the text was corrected
  updated_at  timestamptz not null default now(),
  unique (ref, lang)
);

-- ───────── topics (one list for every library) ─────────
create table if not exists topics (
  id       serial primary key,
  name_en  text not null,
  name_ml  text,
  name_ur  text,
  unique (name_en)
);
create table if not exists hadith_topics (
  id        serial primary key,
  ref       text not null check (ref ~ '^(h:[0-9]{1,9}|s:[A-Za-z0-9:._-]{1,120}|i:[A-Za-z0-9._-]{1,80}/[A-Za-z0-9._-]{1,40})$'),
  topic_id  int not null references topics(id) on delete cascade,
  unique (ref, topic_id)
);
create index if not exists hadith_topics_topic_idx on hadith_topics (topic_id);

-- ───────── per-hadith switches for the extra libraries ─────────
-- hidden = never shown to readers and never given to the AI (a wrong or rejected passage)
create table if not exists source_flags (
  id      serial primary key,
  ref     text not null unique check (ref ~ '^(s:[A-Za-z0-9:._-]{1,120}|i:[A-Za-z0-9._-]{1,80}/[A-Za-z0-9._-]{1,40})$'),
  hidden  boolean not null default false,
  grade   text,                                    -- corrected grading, shown instead of the imported one
  note    text
);

-- ───────── rights ─────────
grant select, insert, update, delete on hadith_texts, topics, hadith_topics, source_flags to hadithencyclo_editor;
grant usage on all sequences in schema public to hadithencyclo_editor;
-- the editor may READ the extra libraries (browsing, search), never change them
grant usage on schema sunnah, ihadis to hadithencyclo_editor;
grant select on all tables in schema sunnah to hadithencyclo_editor;
grant select on all tables in schema ihadis to hadithencyclo_editor;
-- the public API shows the editor's versions and skips hidden passages
grant select on hadith_texts, topics, hadith_topics, source_flags to hadithencyclo_api;

-- ───────── optional grade of an encyclopedia hadith (empty = not graded here) ─────────
-- grade: one of the fixed values below; grade_by: who graded it (e.g. Al-Albani, Shu'ayb al-Arna'ut), free text
alter table hadiths add column if not exists grade text
  constraint hadiths_grade_check check (grade in ('sahih', 'sahih_li_ghairihi', 'hasan', 'hasan_sahih', 'hasan_li_ghairihi', 'daif', 'very_daif', 'mawdu'));
alter table hadiths add column if not exists grade_by text;

-- the public API reads hadith through the view hadith_full; its column list was fixed when it was made (h.*), so the
-- two new columns are added at its END (the only change "create or replace view" allows). Safe to run again.
do $$
declare d text;
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'hadith_full' and column_name = 'grade') then
    d := pg_get_viewdef('public.hadith_full'::regclass, false);
    d := regexp_replace(d, '\s+FROM\s', ', h.grade, h.grade_by FROM ', 'i');      -- first FROM = the main one
    if position('h.grade_by' in d) = 0 then
      raise exception 'could not add grade to hadith_full: %', d;
    end if;
    execute 'create or replace view public.hadith_full as ' || rtrim(d, ' ;');
  end if;
end $$;
