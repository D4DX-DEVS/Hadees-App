# Editor admin page: one-time setup

The editor page lives at `https://hadithencyclopedia.com/admin/`. GitHub Actions uploads the files on every push to `main`
(job `deploy-admin`). Before the first login, do these four steps once on the server. About 15 minutes.

## 1. Database user for the editor

cPanel → **PostgreSQL Databases**:

1. **PostgreSQL Users** → Add user `hadithencyclo_editor`. Use the password generator and copy the password somewhere safe.
2. **Add a user to a database**: `hadithencyclo_editor` → `hadithencyclo_hadees`.

## 2. Tables and rights

Upload `api/editor-role.sql` to the server (e.g. into your home folder) and run it as the database owner in cPanel → **Terminal**:

```bash
psql -h /var/run/postgresql -U hadithencyclo_hadithencyclo -d hadithencyclo_hadees -f editor-role.sql
```

It creates the edit history (`admin_edits`), the data version (`app_meta`) and the AI search queue (`embed_pending`), and lets the
editor user change only the encyclopedia tables. Running it twice is harmless.

## 3. Editor password

Still in the Terminal, make the password hash (replace `the password` with the editor's password; at least 12 characters):

```bash
php -r 'echo password_hash("the password", PASSWORD_DEFAULT), "\n";'
```

Then delete that line from the shell history: `history -d $(history 1 | awk '{print $1}')`.

## 4. Config file

Open `/home/<account>/hadees-config.php` (File Manager, one level above `public_html`) and add these lines inside `return [ ... ]`
(the template is `api/hadees-config.sample.php`):

```php
    'editor_db_user' => 'hadithencyclo_editor',
    'editor_db_pass' => 'the password from step 1',
    'editor_login' => 'editor',
    'editor_password_hash' => 'the $2y$... line from step 3',
    'worker_url' => 'https://hadeeth-ai.d4media.workers.dev',
    'worker_admin_token' => 'the ADMIN_TOKEN secret of the AI worker',
```

`worker_admin_token` is the same value as the worker's `ADMIN_TOKEN` secret (`npx wrangler secret put ADMIN_TOKEN` sets it).
Without it, edits still save, but the AI search is not refreshed (the hadith wait under **AI search** in the menu).

## Check

1. Open `https://hadithencyclopedia.com/admin/` → the login page appears.
2. Log in → Library shows the 4 volumes.
3. Open any hadith, change nothing, press **History**: empty list, no error.

## What the editor should know

- Every save is in **History**, with the old and new text side by side. **Undo** puts the old version back.
  Only the newest change of a hadith can be undone, so later work is never lost by accident.
- The website and the app show a change within about 5 minutes (book and chapter titles: up to 1 hour).
- A Malayalam/Arabic text, narrator or chapter change also refreshes the AI search for that hadith. A book title change refreshes
  every hadith of the book; that can take a few rounds under **AI search** → *Update AI search now*.
- Phones that downloaded a book for offline reading keep their copy until they download it again.
- Five wrong passwords lock the login for 15 minutes. The login ends after 2 hours without activity.

## Important: the live database is now the master copy

Do not rebuild the library from the files on the PC (`scripts/build_cpanel_db.py` + `load.sh`) after editing has started:
a reload would bring back hadith the editor deleted. `load.sh` refuses to run once edits exist (override: `FORCE=1`).
Back up the live database instead (cPanel → Backup, or `pg_dump`).
