"""Prepare the web build (app/dist) for cPanel. Stdlib only. Run after `npx expo export -p web`.

  python -I scripts/pack-cpanel.py          -> hadees-web.zip (for File Manager -> Upload -> Extract), includes an .htaccess
  python -I scripts/pack-cpanel.py --dir    -> deploy/ folder (used by CI over FTP), NO .htaccess: the server keeps its own

Does what build-web.sh does without macOS-only sed: renames assets/node_modules -> assets/vendor (some hosts/tools skip
folders named node_modules) and rewrites the references. The .htaccess makes deep links (/article/5) fall back to index.html."""
import os, shutil, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
ZIP_OUT = os.path.join(ROOT, 'hadees-web.zip')
DIR_OUT = os.path.join(ROOT, 'deploy')
TEXT_EXT = ('.js', '.html', '.json', '.css')
OLD, NEW = 'assets/node_modules', 'assets/vendor'

HTACCESS = """# Single-page app: serve index.html for any path that is not a real file or folder
RewriteEngine On
RewriteCond %{REQUEST_URI} !^/\\.well-known/
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
"""


def build_files():
    """Yield (relative path with forward slashes, bytes) for every build file, with the vendor rename applied."""
    for base, _dirs, files in os.walk(DIST):
        for name in sorted(files):
            full = os.path.join(base, name)
            rel = os.path.relpath(full, DIST).replace(os.sep, '/')
            with open(full, 'rb') as f:
                data = f.read()
            if rel.lower().endswith(TEXT_EXT):
                data = data.replace(OLD.encode(), NEW.encode())
            yield (rel.replace(OLD, NEW, 1) if rel.startswith(OLD) else rel), data


def put(z, name, data):
    """writestr() defaults to mode 0600, which many cPanel servers cannot serve (403). Use the normal web mode 0644."""
    info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = 0o644 << 16
    z.writestr(info, data, compresslevel=9)


def main():
    if not os.path.isfile(os.path.join(DIST, 'index.html')):
        sys.exit('app/dist/index.html not found: run `npx expo export -p web` in app/ first')
    if '--dir' in sys.argv[1:]:
        shutil.rmtree(DIR_OUT, ignore_errors=True)
        count = 0
        for rel, data in build_files():
            path = os.path.join(DIR_OUT, *rel.split('/'))
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'wb') as f:
                f.write(data)
            count += 1
        print(f'wrote {DIR_OUT}: {count} files (no .htaccess)')
        return
    count = 0
    with zipfile.ZipFile(ZIP_OUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for rel, data in build_files():
            put(z, rel, data)
            count += 1
        put(z, '.htaccess', HTACCESS.encode())
    print(f'wrote {ZIP_OUT}: {count + 1} files, {os.path.getsize(ZIP_OUT) / 1e6:.1f} MB')


main()
