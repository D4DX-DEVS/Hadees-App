-- Run ONCE as the database OWNER (hadithencyclo_hadithencyclo, the user that loaded the data), after the data load:
--   psql -h /var/run/postgresql -U hadithencyclo_hadithencyclo -d hadithencyclo_hadees -f db-role.sql
-- (the phpPgAdmin login "hadithencyclo" does not own the tables and gets "permission denied".)
-- Before that, create the user in cPanel -> PostgreSQL Databases -> "PostgreSQL Users" -> Add: hadithencyclo_api
-- (generated strong password), then "Add a user to a database": hadithencyclo_api -> hadithencyclo_hadees.
--
-- The website's API user can: read the library, call the search functions, insert feedback.
-- It cannot: change or delete anything, create tables, or read feedback back.

revoke all on all tables    in schema public from hadithencyclo_api;
revoke all on all sequences in schema public from hadithencyclo_api;
revoke create on schema public from hadithencyclo_api;

grant usage on schema public to hadithencyclo_api;
grant select on all tables in schema public to hadithencyclo_api;   -- RLS policies already allow public read; feedback has insert-only
grant insert on feedback to hadithencyclo_api;
revoke select on feedback from hadithencyclo_api;                  -- contact details are never readable through the API
-- (the 25 s statement timeout is set by api/index.php on every connection)
