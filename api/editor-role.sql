-- Editor admin page (https://<domain>/admin/): tables + database rights. Run ONCE as the database OWNER, after db-role.sql:
--   psql -h /var/run/postgresql -U hadithencyclo_hadithencyclo -d hadithencyclo_hadees -f editor-role.sql
-- Before that, create the user in cPanel -> PostgreSQL Databases -> "PostgreSQL Users" -> Add: hadithencyclo_editor
-- (generated strong password), then "Add a user to a database": hadithencyclo_editor -> hadithencyclo_hadees.
-- Safe to run again (everything is "if not exists" / "drop policy if exists").
--
-- The editor user can: read the library, change the encyclopedia tables listed below, write the edit history.
-- It cannot: create or drop tables, read feedback, touch the sunnah / ihadis libraries.

-- ───────── edit history (every change made in the admin page; Undo writes the old row back) ─────────
create table if not exists admin_edits (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  tbl        text not null,                       -- hadiths, books, chapters, articles, article_blocks, narrators, narrator_spellings
  row_id     text not null,                       -- primary key of the changed row (text: narrator_spellings is keyed by spelling)
  action     text not null check (action in ('insert', 'update', 'delete', 'undo')),
  old_row    jsonb,                               -- full row before (null for insert); hadiths also carry _variants / _relations
  new_row    jsonb,                               -- full row after (null for delete)
  note       text,
  undone_by  bigint references admin_edits(id),   -- set when this edit was undone
  undoes     bigint references admin_edits(id)    -- set on the 'undo' edit itself
);
create index if not exists admin_edits_row_idx on admin_edits (tbl, row_id, id desc);
create index if not exists admin_edits_at_idx on admin_edits (at desc);

-- ───────── data version: goes up by one on every save; the AI worker puts it in its answer cache key ─────────
create table if not exists app_meta (
  key   text primary key,
  value bigint not null
);
insert into app_meta (key, value) values ('data_version', 1) on conflict (key) do nothing;

-- ───────── hadith whose AI search vector must be made again (text, narrator or chapter/book title changed) ─────────
create table if not exists embed_pending (
  hadith_id  int primary key references hadiths(id) on delete cascade,
  since      timestamptz not null default now()
);

-- ───────── rights ─────────
revoke all on all tables    in schema public from hadithencyclo_editor;
revoke all on all sequences in schema public from hadithencyclo_editor;
revoke create on schema public from hadithencyclo_editor;

grant usage on schema public to hadithencyclo_editor;
grant select on all tables in schema public to hadithencyclo_editor;
revoke select on feedback from hadithencyclo_editor;               -- contact details stay private

grant insert, update, delete on hadiths, hadith_variants, hadith_relations, hadith_embeddings,
                               books, chapters, articles, article_blocks, narrator_spellings, embed_pending
  to hadithencyclo_editor;
grant update on narrators to hadithencyclo_editor;
grant insert, update on admin_edits to hadithencyclo_editor;
grant update on app_meta to hadithencyclo_editor;
grant usage on all sequences in schema public to hadithencyclo_editor;

-- row level security: the tables only have "public read" policies, so the editor gets its own write policy
do $$
declare t text;
begin
  foreach t in array array['hadiths', 'hadith_variants', 'hadith_relations', 'hadith_embeddings', 'books', 'chapters',
                           'articles', 'article_blocks', 'narrators', 'narrator_spellings'] loop
    execute format('drop policy if exists editor_write on %I', t);
    execute format('create policy editor_write on %I for all to hadithencyclo_editor using (true) with check (true)', t);
  end loop;
end $$;

-- the public API reads the data version (route data_version), nothing else of these tables
grant select on app_meta to hadithencyclo_api;
