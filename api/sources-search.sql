-- Full-text indexes for the extra libraries (schemas `sunnah` and `ihadis`). Run ONCE as the database OWNER:
--   psql -h /var/run/postgresql -U hadithencyclo_hadithencyclo -d hadithencyclo_hadees -f sources-search.sql
-- Safe to re-run. The API (api/index.php, routes src_*) searches the English text with exactly these expressions,
-- so without the indexes a search would scan every row and hit the 12 s statement timeout.
-- Build time: about a minute each (the sunnah table has ~48,500 English texts, ihadis ~50,000).

create index if not exists sunnah_hadiths_en_fts
    on sunnah.hadiths using gin (to_tsvector('english', coalesce(text_en, '')));

create index if not exists ihadis_hadiths_en_fts
    on ihadis.hadiths using gin (to_tsvector('english', coalesce(translation, '')))
    where lang = 'en';

analyze sunnah.hadiths;
analyze ihadis.hadiths;
