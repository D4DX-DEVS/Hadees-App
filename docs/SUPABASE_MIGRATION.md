# Hadees Vijnanakosham: Supabase migration guide

This guide moves the whole hadith database from our Supabase project to a Supabase project in your own account. Run the steps in order. Each step has a check, so you know it worked before moving on.

## 0. What you need
- A Supabase project in your account (Supabase dashboard, new project).
- The Supabase CLI (`npm i -g supabase` or the Homebrew formula), logged in to your account: `supabase login`.
- This repository (`https://github.com/D4dx-backend/hadeeth-app`).
- For embeddings: Python 3 and the BAAI/bge-m3 model (or a Cloudflare Workers AI account if you use the worker).
- Never paste the service-role key into chat or into a committed file. Put it only in the Supabase dashboard or the CLI.

## 1. Link the new project
```bash
cd hadeeth
supabase link --project-ref <YOUR_PROJECT_REF>
```
Check: `supabase projects list` shows your project as linked.

## 2. Create the schema (in this order)
Run each file with `supabase db query --linked -f <file>` (or paste it into the SQL editor).
1. `supabase/schema.sql`
2. `supabase/articles.sql`
3. `supabase/narrators.sql`
4. `supabase/narrator_groups.sql`
5. `supabase/relations.sql`
6. `supabase/cross_refs.sql`
7. `supabase/search_norm.sql`
8. `supabase/search_v2.sql`
9. `supabase/feedback.sql`
10. `supabase/app_api.sql` (RPC functions the app calls)

Check: `select count(*) from information_schema.tables where table_schema='public'` returns the tables listed in `supabase/schema.sql`.

## 3. Load the hadith data (seeds)
Load every `supabase/seed_*.sql` file, volumes 1, 2, 3, then 4, and within a volume in numeric order. Each seed is idempotent: it deletes and re-inserts its own book.
```bash
for f in $(ls supabase/seed_1.*.sql | sort -V) $(ls supabase/seed_2.*.sql | sort -V) $(ls supabase/seed_3.*.sql | sort -V) $(ls supabase/seed_4.*.sql | sort -V); do
  echo "$f"; supabase db query --linked -f "$f" || break
done
```
Then load the article seeds: `supabase/seed_articles.sql` (volume 1) and `supabase/seed_articles_v4.sql` (volume 4).

## 4. Apply the corrections (fixups), in this order
These fixes were made after the first load. Run them after the seeds, in this order:
1. `supabase/fixups_v1.sql`
2. `supabase/fixups_malayalam_1.sql`
3. `supabase/fixups_malayalam_2.sql`
4. `supabase/fixups_print_check.sql`
5. `supabase/fixups_source_codes.sql`
6. `supabase/fixups_text_corrections.sql` through `supabase/fixups_text_corrections_9.sql` (numeric order)
7. `supabase/flag_held_vol4.sql` (marks the vol 4 items that are still open for review)

## 5. Embeddings (AI search)
Embeddings are not in the seeds. They are big and can be regenerated.
- Local option (no Cloudflare needed): `python3 scripts/embed_local.py` with the bge-m3 model available locally. It writes to `hadith_embeddings` directly through the Supabase CLI.
- Worker option: deploy `worker/` (see step 6) and run `POST /admin/embed` until `remaining` is 0.
Check: `select count(*) from hadith_embeddings` equals the hadith count in step 7.

## 6. Relations and the worker (AI answers and related hadith)
- Recompute relations after all data is loaded: `python3 scripts/relations_batched.py`.
- Worker: `cd worker && npm ci && npx wrangler login` (choose your Cloudflare account), then set the secrets listed at the top of `worker/wrangler.toml`: `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` (only while backfilling embeddings; delete afterwards), `ADMIN_TOKEN`, and optionally `ANTHROPIC_API_KEY`. Then `npx wrangler deploy`.

## 7. Point the app at the new project
Create `app/.env` (it is git-ignored) with:
```
EXPO_PUBLIC_SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
EXPO_PUBLIC_AI_URL=<your worker URL, optional>
```

## 8. Verify the counts
Run `docs/verify_counts.sql` in the SQL editor. Expected results (from the source project, at the time of this guide):

| Vol | Book | Title | Hadith | Embedded | Flagged for review |
|---|---|---|---|---|---|
| 1 | 8 | ദിവ്യ ബോധനം | 13 | 13 | 0 |
| 1 | 9 | വിശ്വാസം | 162 | 162 | 0 |
| 1 | 10 | ശുദ്ധി | 54 | 54 | 0 |
| 1 | 11 | അംഗസ്നാനം | 196 | 196 | 0 |
| 1 | 12 | തയമ്മും | 10 | 10 | 0 |
| 1 | 13 | കുളി | 179 | 179 | 0 |
| 1 | 14 | പള്ളികൾ | 167 | 167 | 0 |
| 1 | 15 | ബാങ്ക് | 94 | 94 | 0 |
| 1 | 16 | അഞ്ചു നിസ്കാരങ്ങൾ | 17 | 17 | 0 |
| 1 | 17 | നിസ്കാര സമയങ്ങൾ | 120 | 120 | 0 |
| 1 | 18 | ജുമുഅഃ | 202 | 202 | 0 |
| 1 | 19 | സംഘടിത നിസ്കാരം | 186 | 186 | 0 |
| 1 | 20 | നിസ്കാരത്തിലെ അനുഷ്ഠാനങ്ങൾ | 322 | 322 | 0 |
| 1 | 21 | സുന്നത്ത് നിസ്കാരങ്ങൾ | 105 | 105 | 0 |
| 1 | 22 | ഖുർആൻ പാരായണത്തിന്റെ സുജൂദ് | 23 | 23 | 0 |
| 1 | 23 | കിതാബുൽ വിത്ർ | 354 | 354 | 0 |
| 1 | 24 | ഗ്രഹണ നിസ്കാരം | 36 | 36 | 0 |
| 1 | 25 | മഴക്കുവേണ്ടിയുള്ള നിസ്കാരം | 37 | 37 | 0 |
| 1 | 26 | രണ്ടു പെരുന്നാളുകൾ | 84 | 84 | 0 |
| 1 | 27 | ഭയപ്പാടുണ്ടാവുമ്പോഴുള്ള നിസ്കാരം | 20 | 20 | 0 |
| 1 | 28 | നന്മയെ തേടിയുള്ള നിസ്കാരം | 38 | 38 | 0 |
| 1 | 29 | യാത്രക്കാരന്റെ നിസ്കാരം | 67 | 67 | 0 |
| 1 | 30 | നിസ്കാരവുമായി ബന്ധപ്പെട്ട മര്യാദകൾ | 229 | 229 | 0 |
| 1 | 31 | മയ്യിത്ത് സംസ്കരണം | 517 | 517 | 0 |
| 2 | 1 | ആമുഖമായി | 0 | 0 | 0 |
| 2 | 2 | നോമ്പ് | 374 | 374 | 0 |
| 2 | 3 | സകാത്ത് | 337 | 337 | 7 |
| 2 | 4 | ഹജ്ജ് | 543 | 543 | 3 |
| 2 | 5 | മര്യാദ | 475 | 475 | 0 |
| 2 | 6 | ഭക്ഷണം | 286 | 286 | 0 |
| 2 | 7 | പാനീയങ്ങൾ | 212 | 212 | 2 |
| 2 | 8 | വസ്ത്രവും ഭംഗിയും | 431 | 431 | 1 |
| 2 | 9 | നന്മചെയ്യലും ബന്ധം പുലർത്തലും | 344 | 344 | 1 |
| 2 | 10 | ഭാര്യമാരോടുള്ള പെരുമാറ്റം | 17 | 17 | 0 |
| 2 | 11 | വിജ്ഞാനത്തിന്റെ ശ്രേഷ്ഠത | 164 | 164 | 0 |
| 2 | 12 | റസൂൽ(സ) പറഞ്ഞ ഉപമകൾ | 15 | 15 | 0 |
| 2 | 13 | പ്രാർത്ഥന | 346 | 346 | 2 |
| 2 | 14 | പശ്ചാത്താപം | 22 | 22 | 1 |
| 2 | 15 | കപട വിശ്വാസികൾ | 8 | 8 | 0 |
| 3 | 1 | ആമുഖമായി | 0 | 0 | 0 |
| 3 | 2 | വിവാഹം | 342 | 342 | 0 |
| 3 | 3 | വിവാഹമോചനം | 203 | 203 | 0 |
| 3 | 4 | കച്ചവടങ്ങൾ | 659 | 659 | 0 |
| 3 | 5 | വിധിയും സാക്ഷ്യവും | 149 | 149 | 0 |
| 3 | 6 | ശിക്ഷാനടപടികൾ | 208 | 208 | 0 |
| 3 | 7 | പ്രതിക്രിയയും നഷ്ടപരിഹാരവും | 126 | 126 | 0 |
| 3 | 8 | ശപഥങ്ങളും നേർച്ചകളും | 126 | 126 | 0 |
| 3 | 9 | അനന്തരാവകാശ നിയമശാസ്ത്രം | 70 | 70 | 0 |
| 3 | 10 | വീണുകിട്ടിയ സാധനം | 17 | 17 | 0 |
| 3 | 11 | രോഗവും ചികിത്സയും | 215 | 215 | 0 |
| 3 | 12 | വസ്വിയ്യത്ത് | 73 | 73 | 0 |
| 3 | 13 | അന്ത്യനാളിന്റെ അടയാളങ്ങൾ | 187 | 187 | 0 |
| 3 | 14 | അന്ത്യദിനവും അതിനു ശേഷവും | 214 | 214 | 0 |
| 3 | 15 | സ്വപ്നം | 52 | 52 | 0 |
| 3 | 16 | ധർമ്മസമരം | 525 | 525 | 0 |
| 4 | 1 | ആമുഖമായി | 0 | 0 | 0 |
| 4 | 2 | ഹദീസിന്റെ പ്രാധാന്യം | 0 | 0 | 0 |
| 4 | 3 | നികുതിയും യുദ്ധമുതലും | 206 | 206 | 33 |
| 4 | 4 | നേതൃത്വം | 106 | 106 | 0 |
| 4 | 5 | ഹിജ്റയും പോരാട്ടങ്ങളും | 169 | 169 | 81 |
| 4 | 6 | സൃഷ്ടിപ്പിന്റെ ആരംഭം | 50 | 50 | 0 |
| 4 | 7 | പ്രവാചകന്മാരുടെ ശ്രേഷ്ഠത | 65 | 65 | 0 |
| 4 | 8 | നബി(സ)യുടെ അപദാനങ്ങൾ | 154 | 154 | 2 |
| 4 | 9 | സഹാബതിന്റെ മഹത്വങ്ങൾ | 500 | 500 | 19 |
| 4 | 10 | മക്കയുടെയും മദീനയുടെയും മഹത്വങ്ങൾ | 60 | 60 | 0 |
| 4 | 11 | ഖുർആന്റെ മഹത്വങ്ങൾ | 186 | 186 | 0 |
| 4 | 12 | ഖുർആൻ വ്യാഖ്യാനം | 466 | 466 | 2 |
| 4 | 13 | നബിചര്യ | 237 | 237 | 0 |
| 4 | 14 | അക്രമങ്ങൾ | 27 | 27 | 0 |
| 4 | 15 | ദാനം | 69 | 69 | 0 |
| 4 | 16 | വ്യവസ്ഥകൾ | 5 | 5 | 0 |
| 4 | 17 | ഉള്ഹിയത്ത് | 110 | 110 | 0 |
| 4 | 18 | വേട്ടയും അറവും | 170 | 170 | 0 |
| 4 | 19 | വിപത്തുകൾ | 185 | 185 | 1 |
| 4 | 20 | ഗ്രന്ഥകർത്താവിനെക്കുറിച്ച് | 0 | 0 | 0 |

Totals: 12737 hadith, 155 flagged for review, 12737 embeddings. Articles: 14 sections (see the checklist PDF).

Book 20 (vol 4) is not loaded yet: its PDF is not available. Books 1 and 2 of vol 4 are the introduction and are stored as articles, not hadith.

## 9. Keep a backup
`python3 scripts/backup.py` exports the public tables to `backups/<date>/` as compressed JSON. Keep that folder with the migration. It is a reference copy of the data, not a restore script.

## Troubleshooting
- A seed fails with a foreign key error: the schema step (2) was skipped or run out of order.
- Counts differ from the table: check that every seed in step 3 ran, then the fixups in step 4.
- AI search returns nothing: check the embeddings count (step 5) and that the worker has `SUPABASE_SERVICE_KEY` set during the backfill.
