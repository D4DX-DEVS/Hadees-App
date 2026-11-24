# Editor admin page: plan

Status: draft, waiting for approval (24 Nov 2026).

## Goal

One editor can correct the encyclopedia on the live cPanel database from a browser, without rebuilding the database from this PC.
Example: open Volume 4, book 3, hadith 214, fix a word in the Malayalam text, save. The website and the app show the fix, search
finds the new wording, and the AI uses it.

## Decisions taken

| Question | Answer |
|---|---|
| Who uses it | The editor only. One shared login. |
| Where | `https://hadithencyclopedia.com/admin/` on the same cPanel |
| What can be edited | Hadith (all fields), book and chapter titles, articles (blocks), narrators (name, biography, spellings) |
| Not included | Sunnah.com and ihadis libraries (copies of outside sites, read-only), feedback inbox |

## How it is built

- **Plain PHP + a small amount of plain JavaScript**, like `api/index.php` (one stack on cPanel, no build step, nothing to install).
  New folder `admin/` in the repo, deployed by a new job in `.github/workflows/deploy-cpanel.yml` (FTPS, same secrets).
- **Own database user** `hadithencyclo_editor`, created once with `api/editor-role.sql`. It may read everything, and change only
  `hadiths`, `hadith_variants`, `books`, `chapters`, `articles`, `article_blocks`, `narrators`, `narrator_spellings`,
  `hadith_embeddings`, `admin_edits`, `app_meta`. The public API user stays read-only.
- **Login**: one username, password stored as a hash (`password_hash`) in `hadees-config.php`, which already lives outside the
  web root and is never deployed. Session cookie HttpOnly + Secure + SameSite=Strict, CSRF token on every save, logout after 2 h
  idle, login locked for 15 min after 5 wrong passwords. Every admin page sends `noindex` and no-cache headers.

## What happens on every save

1. **Edit history.** One row in a new table `admin_edits` (time, table, row id, action, full old row, full new row, optional note).
   The History page shows the change side by side and has an **Undo** button that writes the old row back (recorded as an edit too).
2. **Keyword search**: nothing to do. The existing trigger `hadiths_before_write` already refreshes `arabic_plain`,
   `malayalam_search`, `narrator_search` and `updated_at`.
3. **AI search (meaning)**: the admin asks the AI worker for a new embedding (`POST /admin/embed`, worker `ADMIN_TOKEN` kept in
   `hadees-config.php`) of the same text the original embedding used (chapter title + Malayalam + Arabic) and stores it in
   `hadith_embeddings`. If the worker does not answer (daily free limit), the hadith is marked "AI search not updated yet" and a
   **Retry** button appears; the edit itself is saved anyway.
4. **Saved AI answers** (kept 30 days by the worker): a `data_version` number in a new one-row table `app_meta` goes up by one.
   The worker puts that number in its cache key (read from a new API route, cached 5 min), so every answer is made fresh after
   an edit.
5. **Browser cache**: library responses are cached up to 5 min (`TTL = 300`), the volume and book lists up to 1 h. A fix is
   visible to everyone within that time. Book/chapter title edits: up to 1 h. Acceptable; no change planned.

## Screens

1. **Login**
2. **Find**: Volume → Book → Chapter → hadith list; a "go to" box (`4 / 3 / 214` = volume / book / hadith number); text search
   using the existing search function; filter "needs review" (the 155 hadith flagged during OCR).
3. **Hadith editor**: every field (Arabic text right-to-left with the Arabic font, Malayalam text with the Malayalam font,
   narrator, explanation, label, source codes, grading note, pages, needs-review switch, variants). Preview exactly as the app
   shows it. Add a hadith to a chapter; delete one (confirmation dialog; the full row stays in History so it can be restored).
4. **Books & chapters**: titles (Malayalam + Arabic), start page; add, rename, reorder chapters.
5. **Articles**: list of blocks (heading, paragraph, Arabic, list item, table, footnote); edit, add, delete, move up/down.
6. **Narrators**: name, biography, page; the list of spellings that link hadith to the narrator (add / remove).
7. **History**: every edit, newest first, filter by volume or table, Undo.

## Things outside the admin that must change

- **The cPanel database becomes the master copy.** `scripts/build_cpanel_db.py` + `db-bundle/load.sh` would wipe the editor's
  work. The loader gets a guard: it stops if `admin_edits` has rows, unless run with `--force`. README / DEPLOY docs say so.
- **Backups**: daily `pg_dump` of the database by a cPanel cron job, last 14 kept (instructions in `docs/DEPLOY_CPANEL.md`).
- **Offline books on phones** keep their old copy. New API route returns the last change time per book; the Offline books
  screen shows "Updated, download again" when the server copy is newer than the downloaded one.

## Phases

| Phase | Contents | Result |
|---|---|---|
| 1 | Editor DB user, `admin_edits` + `app_meta`, login, Find, Hadith editor, History + Undo, re-embedding, AI cache version, deploy job, loader guard | The editor can fix any hadith in any volume |
| 2 | Books & chapters, Articles, Narrators screens | Everything selected is editable |
| 3 | Offline "updated" notice in the app, backup cron | Phones and backups follow the edits |

## One-time steps on the server (the owner does these, with instructions)

1. cPanel → PostgreSQL → add user `hadithencyclo_editor`, add it to the database.
2. Run `api/editor-role.sql` as the database owner (creates the two tables, gives the rights).
3. Add to `hadees-config.php`: editor DB password, editor username + password hash (a small script prints it), worker admin token.

## Testing

- PHP: syntax check in CI (as for the API) and a test script run against a local copy of the database: login, lockout, CSRF
  refusal, save, history row written, undo, re-embedding stored, `data_version` raised, editor user cannot touch other tables.
- Browser: each screen checked at 375, 768 and 1280 px wide.
