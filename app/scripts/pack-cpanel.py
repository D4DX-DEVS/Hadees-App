"""Pack the web build (app/dist) into hadees-web.zip for upload to cPanel (File Manager -> Upload -> Extract).
Does what build-web.sh does without macOS-only sed: renames assets/node_modules -> assets/vendor (some hosts/tools skip
folders named node_modules) and rewrites the references. Adds an .htaccess so deep links (/article/5) fall back to index.html.
Stdlib only. Run after `npx expo export -p web`:  python -I scripts/pack-cpanel.py"""
import os, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
OUT = os.path.join(ROOT, 'hadees-web.zip')
TEXT_EXT = ('.js', '.html', '.json', '.css')
OLD, NEW = 'assets/node_modules', 'assets/vendor'

HTACCESS = """# Single-page app: serve index.html for any path that is not a real file or folder
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
"""

if not os.path.isfile(os.path.join(DIST, 'index.html')):
    sys.exit('app/dist/index.html not found: run `npx expo export -p web` in app/ first')

def put(z, name, data):
    """writestr() defaults to mode 0600, which many cPanel servers cannot serve (403). Use the normal web mode 0644."""
    info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    z.writestr(info, data, compresslevel=9)


count = 0
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for base, _dirs, files in os.walk(DIST):
        for name in sorted(files):
            full = os.path.join(base, name)
            rel = os.path.relpath(full, DIST).replace(os.sep, '/')
            data = open(full, 'rb').read()
            if rel.lower().endswith(TEXT_EXT):
                data = data.replace(OLD.encode(), NEW.encode())
            put(z, rel.replace(OLD, NEW, 1) if rel.startswith(OLD) else rel, data)
            count += 1
    put(z, '.htaccess', HTACCESS.encode())
print(f'wrote {OUT}: {count + 1} files, {os.path.getsize(OUT) / 1e6:.1f} MB')
