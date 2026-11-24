# Hosting on cPanel (hadithencyclopedia.com)

Everything runs on the cPanel server. Nothing depends on Supabase any more.

```
browser / app ──► public_html/            static web app (Expo web export)
              └─► public_html/api/index.php   PHP API  ──►  PostgreSQL `hadithencyclo_hadees` (pgvector)
AI worker (Cloudflare) ──► api/index.php?r=search | ?r=match
```

| Piece | Where | Deployed by |
|---|---|---|
| Web app | `app/` -> `public_html/` | GitHub Actions (or manual zip) |
| PHP API | `api/` -> `public_html/api/` | GitHub Actions (or manual zip) |
| Database | PostgreSQL on the server | loaded once (`scripts/build_cpanel_db.py` bundle) |
| AI worker | `worker/` -> Cloudflare Workers | `npx wrangler deploy` by hand |
| DB password | `/home/<account>/hadees-config.php` | by hand, NEVER in git or in `public_html` |

## 1. Server one-time setup (already done for hadithencyclopedia.com)
1. PostgreSQL database loaded (`docs/SUPABASE_MIGRATION.md` explains the data, `99_verify.sql` compares checksums).
2. PHP 8.3 for the domain (cPanel -> MultiPHP Manager) with the `ea-php83-php-pgsql` package installed (WHM terminal: `dnf install ea-php83-php-pgsql`).
3. Read-only database user: create `hadithencyclo_api` in cPanel -> PostgreSQL Databases, add it to the database, then run `api/db-role.sql` as the database OWNER (`psql -h /var/run/postgresql -U hadithencyclo_hadithencyclo -d hadithencyclo_hadees -f api/db-role.sql`). It can read the library and insert feedback, nothing else.
4. `/home/<account>/hadees-config.php` (copy of `api/hadees-config.sample.php`) with that user's password and a long random `match_key`. Set `debug` to `false` when it works.
5. Check: `https://<domain>/api/index.php?r=health` -> `{"ok":true,"db":true,"hadiths":12737}`.

## 2. GitHub Actions (push to `main` touching `app/` or `api/`)
`.github/workflows/deploy-cpanel.yml`: **check** (PHP syntax, typecheck, lint) -> **deploy-api** (upload `api/`, health check) -> **deploy** (build web app, upload changed files, smoke test).

### One-time GitHub setup
1. cPanel -> **FTP Accounts** -> add `deploy`, **Directory** `public_html`. Use it only for deploys.
2. Repo -> Settings -> Secrets and variables -> Actions:

| Secret | Value |
|---|---|
| `FTP_HOST` | FTP server name from the FTP Accounts page |
| `FTP_USERNAME` | full FTP login, e.g. `deploy@hadithencyclopedia.com` |
| `FTP_PASSWORD` | that account's password |
| `EXPO_PUBLIC_API_URL` | `https://hadithencyclopedia.com/api/index.php` |
| `EXPO_PUBLIC_AI_URL` | the Ask-AI worker URL |

| Variable | Value |
|---|---|
| `SITE_URL` | `https://hadithencyclopedia.com` (turns on the health check and smoke test) |
| `FTP_SERVER_DIR` | only if the FTP account's home is not the web root (must end with `/`); default `./` |

3. Settings -> Environments -> `production` -> add **Required reviewers** if you want an approval before each deploy.

The pipeline never uploads `.htaccess` for the site root, `.well-known`, `php.ini` or the database password file. Keep the single-page-app rules in `public_html/.htaccess` (see `app/scripts/pack-cpanel.py`).

## 3. AI worker (Cloudflare)
```
cd worker
npm install
npx wrangler login
npx wrangler secret put MATCH_KEY     # same value as 'match_key' in hadees-config.php
npx wrangler deploy
```
`API_URL` is set in `worker/wrangler.toml`. The worker embeds the question with Workers AI and asks the PHP API for the nearest hadith (`?r=match`, protected by `MATCH_KEY`) and for keyword matches (`?r=search`), so it always uses the same hadith ids as the app.

## 4. Manual fallback (no GitHub)
- Web app: `cd app && npx expo export -p web && python -I scripts/pack-cpanel.py`, upload `app/hadees-web.zip` in File Manager and extract into `public_html` (do not overwrite the server's `.htaccess`).
- API: `python -I scripts/pack_api.py`, upload `api-php.zip` and extract into `public_html`.

## If something fails
- **check fails**: fix the PHP/TypeScript error it prints, push again.
- **FTP login/TLS error**: `FTP_HOST` must be the host name on the FTP Accounts page.
- **Health check fails** (`"db":false`): set `debug` to `true` in `hadees-config.php`, open `?r=health` to see the real database error, then set it back.
- **`could not find driver`**: the domain's PHP version has no `pgsql`; use the PHP version that has it (MultiPHP Manager).
- **Roll back**: revert the commit on `main`; the pipeline redeploys the previous version.

## 5. Extra libraries (sunnah.db, ihadis.db)
Loaded into the SAME database as separate schemas `sunnah` and `ihadis` (the live library in `public` is never touched; the API user gets read-only access).
```
python -I scripts/build_sources_db.py sunnah     # -> sunnah-bundle.zip   (add --with-html to keep arabic_html/english_html)
python -I scripts/build_sources_db.py ihadis     # -> ihadis-bundle.zip
```
Upload each zip to `/home/<account>/` (NOT `public_html`), extract, then in the WHM terminal:
`cd /home/<account>/sunnah-bundle && chmod +x load.sh && ./load.sh` (asks for the database owner's password, runs in the background, ends with the verification list that must equal `99_expected.txt`). Re-running is safe: it drops and recreates only its own schema.
