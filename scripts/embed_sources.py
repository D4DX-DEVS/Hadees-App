"""Embed the English text of sunnah.db with the worker's Workers AI model (BAAI/bge-m3, 1024 numbers, normalized) and write a
PostgreSQL bundle (sources-bundle/sunnah-embeddings/ + sunnah-embeddings-bundle.zip) that adds table sunnah.hadith_embeddings.
Stdlib only. Resumable: a finished chunk file is never embedded again.

  set ADMIN_TOKEN_FILE=<file with the worker's ADMIN_TOKEN secret>     (never print or paste the token)
  python -I scripts/embed_sources.py [--limit N] [--db PATH]            --limit N: only the first N passages (a cheap test run)

Cost: the whole library is ~4.4 million tokens (about 4,700 Workers AI neurons of the free 10,000 per day). The worker route /admin/embed
exists only while the ADMIN_TOKEN secret is set: delete it afterwards (npx wrangler secret delete ADMIN_TOKEN)."""
import json, os, sqlite3, sys, time, urllib.error, urllib.request, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = r'D:\Projects\sunnah\sunnah.db'
URL = 'https://hadeeth-ai.d4dx-erp.workers.dev/admin/embed'
BATCH = 40            # texts per request
CHUNK = 1000          # rows per SQL file (~8 MB)
OUT = os.path.join(ROOT, 'sources-bundle', 'sunnah-embeddings')
ZIP = os.path.join(ROOT, 'sunnah-embeddings-bundle.zip')
API_USER = 'hadithencyclo_api'

if '--db' in sys.argv:
    DB = sys.argv[sys.argv.index('--db') + 1]
LIMIT = int(sys.argv[sys.argv.index('--limit') + 1]) if '--limit' in sys.argv else None
if LIMIT:   # a test run must never leave chunk files that a later full run would skip as "finished"
    OUT += '-test'
    ZIP = ZIP.replace('.zip', '-test.zip')
token = open(os.environ['ADMIN_TOKEN_FILE'], encoding='utf-8').read().strip()

con = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
rows = con.execute("select urn, text_en from hadiths where text_en is not null and text_en <> '' order by urn").fetchall()
if LIMIT:
    rows = rows[:LIMIT]
print(f'{len(rows)} English passages', flush=True)
os.makedirs(OUT, exist_ok=True)


def embed(texts):
    body = json.dumps({'texts': texts}, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(URL, data=body, headers={'content-type': 'application/json', 'x-admin-token': token, 'user-agent': 'Mozilla/5.0 embed-sources'})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)['vectors']
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:300]
            if e.code in (403, 404):
                sys.exit(f'HTTP {e.code}: {msg}  (is the ADMIN_TOKEN secret set on the worker, and the token file right?)')
            print(f'  HTTP {e.code} {msg} (try {attempt + 1})', flush=True)
        except Exception as e:  # network hiccup
            print(f'  {type(e).__name__}: {e} (try {attempt + 1})', flush=True)
        time.sleep(5 * (attempt + 1))
    sys.exit('giving up: too many failures (the daily free Workers AI allowance may be used up; run again later, finished chunks are kept)')


t0, done_rows = time.time(), 0
for c, start in enumerate(range(0, len(rows), CHUNK), 1):
    path = os.path.join(OUT, f'10_data_embeddings_{c:03d}.sql')
    part = rows[start:start + CHUNK]
    if os.path.exists(path):
        done_rows += len(part)
        continue
    lines = []
    for i in range(0, len(part), BATCH):
        sub = part[i:i + BATCH]
        vecs = embed([t for _, t in sub])
        if len(vecs) != len(sub) or any(len(v) != 1024 for v in vecs):
            sys.exit('unexpected embedding shape')
        lines += [f'{urn}\t[{",".join(f"{x:.5f}" for x in v)}]\n' for (urn, _), v in zip(sub, vecs)]
    with open(path + '.tmp', 'w', encoding='utf-8', newline='\n') as f:
        f.write('copy sunnah.hadith_embeddings (urn, embedding) from stdin;\n' + ''.join(lines) + '\\.\n')
    os.replace(path + '.tmp', path)
    done_rows += len(part)
    rate = done_rows / max(time.time() - t0, 1)
    print(f'chunk {c}: {done_rows}/{len(rows)} rows, {rate:.1f}/s, ~{(len(rows) - done_rows) / max(rate, 0.1) / 60:.0f} min left', flush=True)


def write(name, text):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


write('00_schema.sql', 'create extension if not exists vector;\n'
      'drop table if exists sunnah.hadith_embeddings;\n'
      'create table sunnah.hadith_embeddings (urn text primary key, embedding vector(1024) not null);\n')
write('80_indexes.sql', 'create index if not exists sunnah_hadith_embeddings_hnsw on sunnah.hadith_embeddings using hnsw (embedding vector_cosine_ops);\nanalyze sunnah.hadith_embeddings;\n')
write('90_grants.sql', f'grant select on sunnah.hadith_embeddings to {API_USER};\n')
write('99_verify.sql', "select 'sunnah.hadith_embeddings rows=' || count(*) as line from sunnah.hadith_embeddings;\n")
write('99_expected.txt', f'sunnah.hadith_embeddings rows={len(rows)}\n')
with open(os.path.join(ROOT, 'scripts', 'cpanel_load.sh'), 'rb') as src, open(os.path.join(OUT, 'load.sh'), 'wb') as dst:
    dst.write(src.read().replace(b'\r\n', b'\n'))
with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for f in sorted(os.listdir(OUT)):
        info = zipfile.ZipInfo(f'sunnah-embeddings-bundle/{f}', date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = (0o755 if f == 'load.sh' else 0o644) << 16
        with open(os.path.join(OUT, f), 'rb') as fh:
            z.writestr(info, fh.read(), compresslevel=6)
print(f'DONE {len(rows)} rows in {(time.time() - t0) / 60:.1f} min; wrote {ZIP} ({os.path.getsize(ZIP) // 1048576} MB)', flush=True)
