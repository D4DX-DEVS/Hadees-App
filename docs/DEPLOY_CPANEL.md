# Deploying the web app to cPanel from GitHub

Every push to `main` that touches `app/` runs `.github/workflows/deploy-cpanel.yml`:
typecheck + lint, then build the web app, upload only the files that changed, and check the live site.
The database stays on Supabase; only the static website is deployed.

## One-time setup

### 1. A dedicated FTP account (cPanel)
cPanel -> **FTP Accounts** -> Add. Give it a strong password and set its **Directory** to `public_html`
(the folder the domain serves). Use this account only for deploys, not your main cPanel login.

### 2. GitHub secrets (repo -> Settings -> Secrets and variables -> Actions)
| Secret | Value |
|---|---|
| `FTP_HOST` | your server name from the FTP Accounts page (or the domain), no `ftp://` |
| `FTP_USERNAME` | the FTP account created above (full name, e.g. `deploy@yourdomain.com`) |
| `FTP_PASSWORD` | that account's password |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | the publishable (anon) key. Never the service-role key |
| `EXPO_PUBLIC_AI_URL` | the Ask-AI worker URL |

Variables (same page, Variables tab), both optional:
| Variable | Value |
|---|---|
| `SITE_URL` | `https://yourdomain.com` (enables the smoke test after each deploy) |
| `FTP_SERVER_DIR` | only if the FTP account's home is not the web root; default `./` |

### 3. Protect production (recommended)
Repo -> Settings -> Environments -> `production` -> add **Required reviewers** so a deploy waits for an approval,
and restrict it to the `main` branch.

### 4. The server's `.htaccess`
The pipeline never uploads or overwrites `.htaccess`. Keep the single-page-app rules once in `public_html/.htaccess`
(see `app/scripts/pack-cpanel.py` for the block). Deep links like `/article/5` need them.

## Everyday use
Merge to `main` -> approve the deploy if you added reviewers -> done. To redeploy by hand: Actions -> *Deploy web app to cPanel* -> Run workflow.

## If something fails
- **check job fails**: fix the typecheck/lint error it prints, push again.
- **FTP login/TLS error**: `FTP_HOST` must be the host name on the FTP Accounts page. If the certificate name does not match,
  use that host name; only as a last resort add `security: loose` to the upload step.
- **Smoke test fails**: open the Actions log, then open the site in a browser and check the F12 Console.
- **Roll back**: revert the commit on `main` and the pipeline redeploys the previous version.

## Manual fallback
`cd app && npx expo export -p web && python -I scripts/pack-cpanel.py`, then upload `app/hadees-web.zip` in File Manager and extract it
(do not overwrite the server's merged `.htaccess`).
