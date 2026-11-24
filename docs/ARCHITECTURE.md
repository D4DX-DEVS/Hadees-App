# How it works: where everything lives

Hadees Vijnanakosham (hadithencyclopedia.com). Three parts: the **app**, the **API + database** on cPanel, and the **AI worker** on Cloudflare.

```
 Browser / phone app (Expo)                    hadithencyclopedia.com
        |  library, search, hadith             (static files on cPanel)
        v
 PHP API  /api/index.php  ──────────►  PostgreSQL  (cPanel server)
        ^   (?r=route)                   db: hadithencyclo_hadees
        |                                  ├─ public  : the encyclopedia
        |  x-api-key (match_key)           ├─ sunnah  : Sunnah.com library
        |                                  └─ ihadis  : iHadis library
 AI worker (Cloudflare Workers)
   hadeeth-ai.d4dx-erp.workers.dev
        ├─ Workers AI : Gemma 4 (answers), bge-m3 (embeddings)
        └─ KV "CACHE" : cached answers
```

## 1. App
- Expo (React Native Web) in `app/`. The web build is served from cPanel `public_html`.
- Talks to two URLs: the API (`EXPO_PUBLIC_API_URL`) and the AI worker (`EXPO_PUBLIC_AI_URL`).
- **Deploy:** push to `main`. GitHub Actions (`.github/workflows/deploy-cpanel.yml`) builds `app/` and uploads it together with `api/` to cPanel by FTP.

## 2. API and database (cPanel)
- `api/index.php`: one PHP script, routes are chosen with `?r=name`. It is the only thing that talks to the database.
- Config with the database password and `match_key` is **outside** the web root: `/home/hadithencyclo/hadees-config.php` (not in git). Keep `'debug' => false`.
- PostgreSQL database `hadithencyclo_hadees`, three schemas:
  - `public`: the encyclopedia (volumes, books, chapters, hadith, narrators, articles) and its meaning search (route `match`, which calls the database function `match_hadiths`).
  - `sunnah`: Sunnah.com data. `hadiths` (163,210; 48,586 with English), grades, topics, books. `hadith_embeddings` holds one 1024-dim vector (pgvector) per English hadith.
  - `ihadis`: iHadis data. `hadiths` (137,130; 49,898 with English).
- The API user `hadithencyclo_api` can only **read** (SELECT). Loading and index changes use the owner `hadithencyclo_hadithencyclo` (in the WHM terminal).
- Search: Postgres full-text search (a generated `fts` column with GIN index) plus pgvector for meaning-based search. There is no vector index on `sunnah.hadith_embeddings` (the HNSW build was too slow on this server); scanning 48,586 rows is fast enough.
- New routes for the extra libraries: `src_stats`, `src_search` (keywords), `src_hadith` (one hadith), `src_match` (meaning search, needs the `x-api-key` header).
- Data comes in as SQL "bundles" built by `scripts/build_sources_db.py` (SQLite → Postgres) and loaded with `load.sh`. Steps are in `docs/DEPLOY_CPANEL.md`.

## 3. AI worker (Cloudflare)
- `worker/src/index.ts`, deployed by hand with `npx wrangler deploy` from `worker/`. URL: `https://hadeeth-ai.d4dx-erp.workers.dev`.
- **Workers AI** (free tier, 10,000 neurons/day): `@cf/google/gemma-4-26b-a4b-it` writes the answers; `@cf/baai/bge-m3` makes the embeddings (it understands Malayalam and English).
- **KV** (`CACHE`): caches answers and keywords. If you change the prompt or logic, bump the key prefix (`ask7:` now), otherwise old answers are served.
- **Secrets** (set with `wrangler secret put`, never in git): `MATCH_KEY` (same value as `match_key` in the cPanel config). Optional: `ADMIN_TOKEN`, `ANTHROPIC_API_KEY`.

### What happens on a question (`POST /ask`)
1. The question is embedded with bge-m3.
2. The worker asks the API for the closest encyclopedia hadith (meaning search plus keywords) → numbered sources `[1]…[8]`.
3. If the app sent `extra: true`, it also asks `src_match` for the closest Sunnah.com English hadith by meaning (falls back to keyword search). Passages graded fabricated/mawdu/munkar/batil are dropped in code; weak (da'if) ones are marked.
4. Gemma answers **only from those passages**, in Malayalam, citing `[n]`. Weak passages get "(ദുർബലമായ ഹദീസ്)" added by code.
5. The answer plus the sources are returned and cached. The app shows the answer, the encyclopedia references, then "Sunnah.com · English".

## Where to look when something breaks
| Symptom | Check |
|---|---|
| Whole site/API errors | `https://hadithencyclopedia.com/api/index.php?r=health` (set `'debug' => true` temporarily to see the reason) |
| AI says "limited" or gives no answer | Workers AI daily quota used up (resets daily); `npx wrangler tail` in `worker/` |
| AI answers show keywords not meaning (`extra_q` is not `semantic`) | `select count(*) from sunnah.hadith_embeddings;` should be 48586; API user needs SELECT on it |
| Old answer after a code change | Bump the KV key prefix in the worker |
| App change not visible | GitHub Actions run for `main` failed or the browser cached the old bundle |
