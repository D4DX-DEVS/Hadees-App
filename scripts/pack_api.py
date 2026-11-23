"""Zip the PHP API for cPanel File Manager -> Upload -> Extract in public_html. Stdlib only.

  python -I scripts/pack_api.py    ->  api-php.zip   (contains api/index.php, api/.htaccess, api/hadees-config.sample.php)

The database password is NOT in the zip: create /home/<account>/hadees-config.php by hand (see api/hadees-config.sample.php).
Files get mode 0644 (a default zipfile.writestr gives 0600, which many cPanel servers cannot serve)."""
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'api')
OUT = os.path.join(ROOT, 'api-php.zip')
FILES = ['index.php', '.htaccess', 'hadees-config.sample.php']

with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name in FILES:
        with open(os.path.join(SRC, name), 'rb') as f:
            data = f.read()
        info = zipfile.ZipInfo('api/' + name, date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        z.writestr(info, data, compresslevel=9)
print(f'wrote {OUT}: {len(FILES)} files, {os.path.getsize(OUT)} bytes')
