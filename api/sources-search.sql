-- Full-text search columns + indexes for the extra libraries (schemas `sunnah` and `ihadis`).
-- Run as the database OWNER (safe to re-run):
--   psql -h /var/run/postgresql -U hadithencyclo_hadithencyclo -d hadithencyclo_hadees -f sources-search.sql
-- The API (api/index.php, routes src_*) searches the stored column `fts` (English text only). A stored column
-- means ranking does not recompute the text search vector for every candidate row (the first version did, and a
-- query with common words took 10 s).
-- Takes a few minutes: adding a stored column rewrites the table once.

alter table sunnah.hadiths
    add column if not exists fts tsvector
    generated always as (to_tsvector('english', coalesce(text_en, ''))) stored;
create index if not exists sunnah_hadiths_fts_idx on sunnah.hadiths using gin (fts);

alter table ihadis.hadiths
    add column if not exists fts tsvector
    generated always as (to_tsvector('english', case when lang = 'en' then coalesce(translation, '') else '' end)) stored;
create index if not exists ihadis_hadiths_fts_idx on ihadis.hadiths using gin (fts);

-- the first-version expression indexes are no longer used
drop index if exists sunnah.sunnah_hadiths_en_fts;
drop index if exists ihadis.ihadis_hadiths_en_fts;

-- the ALTER ran as the owner: the read-only API user must be able to read the new column
grant select on sunnah.hadiths, ihadis.hadiths to hadithencyclo_api;

analyze sunnah.hadiths;
analyze ihadis.hadiths;
