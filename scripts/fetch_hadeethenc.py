"""Fetch every hadith that HadeethEnc (hadeethenc.com public API) has in Malayalam: Arabic, Malayalam, English, attribution, grade.
Resumable; writes data/verify/hadeethenc/hadith.jsonl (one JSON object per hadith). Usage: python3 scripts/fetch_hadeethenc.py"""
import concurrent.futures as cf, json, os, sys, time, urllib.request

BASE = 'https://hadeethenc.com/api/v1'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data/verify/hadeethenc')
os.makedirs(OUT, exist_ok=True)


def get(path, tries=4):
    for n in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(BASE + path, headers={'User-Agent': 'hadees-vijnanakosham-verify/1.0'}), timeout=40) as r:
                return json.load(r)
        except Exception as e:
            if n == tries - 1:
                raise
            time.sleep(1.5 * (n + 1))


cats = get('/categories/list/?language=ml')
ids = {}
for c in cats:
    page = 1
    while True:
        d = get(f"/hadeeths/list/?language=ml&category_id={c['id']}&page={page}&per_page=50")
        for h in d['data']:
            ids[h['id']] = h['title']
        if page >= int(d['meta']['last_page']):
            break
        page += 1
print('categories', len(cats), 'unique hadith with Malayalam:', len(ids), flush=True)

done = set()
path = os.path.join(OUT, 'hadith.jsonl')
if os.path.exists(path):
    done = {json.loads(l)['id'] for l in open(path, encoding='utf-8')}


def one(i):
    ml = get(f'/hadeeths/one/?language=ml&id={i}')
    en = get(f'/hadeeths/one/?language=en&id={i}')
    return {'id': i, 'ar': ml.get('hadeeth_ar'), 'ml': ml.get('hadeeth'), 'ml_title': ml.get('title'), 'ml_explanation': ml.get('explanation'),
            'en': en.get('hadeeth'), 'attribution_ar': ml.get('attribution_ar'), 'attribution_ml': ml.get('attribution'),
            'grade_ar': ml.get('grade_ar'), 'grade_ml': ml.get('grade'), 'categories': ml.get('categories')}


todo = [i for i in ids if i not in done]
print('to fetch', len(todo), flush=True)
with open(path, 'a', encoding='utf-8') as f, cf.ThreadPoolExecutor(6) as ex:
    futs = {ex.submit(one, i): i for i in todo}
    for n, fu in enumerate(cf.as_completed(futs), 1):
        try:
            f.write(json.dumps(fu.result(), ensure_ascii=False) + '\n')
            f.flush()
        except Exception as e:
            print('failed', futs[fu], e, flush=True)
        if n % 200 == 0:
            print(n, flush=True)
print('done')
