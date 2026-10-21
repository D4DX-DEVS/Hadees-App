"""Export every public-readable table to backups/<date>/<table>.json.gz (stdlib only).
Reads EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY from app/.env. Embeddings (regenerable) and feedback (not public) are skipped;
for those use `supabase db dump`. Usage: python3 scripts/backup.py"""
import gzip, json, os, re, sys, urllib.request, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = dict(re.findall(r'^(\w+)=(.*)$', open(os.path.join(ROOT, 'app/.env')).read(), re.M))
URL, KEY = env['EXPO_PUBLIC_SUPABASE_URL'], env['EXPO_PUBLIC_SUPABASE_ANON_KEY']
TABLES = ['volumes', 'books', 'chapters', 'sources', 'hadiths', 'hadith_variants', 'hadith_relations',
          'articles', 'article_blocks', 'narrators', 'narrator_spellings']
PAGE = 1000
out = os.path.join(ROOT, 'backups', datetime.date.today().isoformat())
os.makedirs(out, exist_ok=True)


def page(table, start):
    req = urllib.request.Request(f'{URL}/rest/v1/{table}?select=*', headers={
        'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Range': f'{start}-{start + PAGE - 1}', 'Range-Unit': 'items'})
    return json.load(urllib.request.urlopen(req, timeout=60))


for t in TABLES:
    rows, start = [], 0
    while True:
        chunk = page(t, start)
        rows += chunk
        if len(chunk) < PAGE:
            break
        start += PAGE
    with gzip.open(os.path.join(out, t + '.json.gz'), 'wt', encoding='utf-8') as f:
        json.dump(rows, f, ensure_ascii=False)
    print(f'{t}: {len(rows)} rows')
print('saved to', out)
