"""Copy hadith_embeddings from the linked source project to the target (TARGET_DB_URL in .target.env).
Reads 500 rows at a time through the Supabase CLI, inserts them with psycopg. Idempotent (upsert)."""
import json, os, re, subprocess, time, time
import psycopg
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
url = re.match(r"^TARGET_DB_URL='(.+)'$", open(os.path.join(ROOT, '.target.env'), encoding='utf-8').read().strip(), re.S).group(1)
def src(sql):
    last = ''
    for attempt in range(4):
        out = subprocess.run(['supabase', 'db', 'query', '--linked', sql], capture_output=True, text=True, cwd=ROOT).stdout
        if '{' in out and '"rows"' in out:
            return json.loads(out[out.index('{'):out.rindex('}') + 1])['rows']
        last = out[-300:]
        time.sleep(3)
    raise RuntimeError('source query failed: ' + last)
IDMAP = {int(k): v for k, v in json.load(open(os.path.join(ROOT, 'data/hadith_id_map.json'))).items()}  # source id -> target id
total = int(src('select count(*) n from hadith_embeddings')[0]['n'])
print('source embeddings', total, flush=True)
done = 0
with psycopg.connect(url, autocommit=True) as conn:
    for off in range(0, total, 300):
        rows = src(f'select hadith_id, model, embedding::text as v from hadith_embeddings order by hadith_id offset {off} limit 300')
        with conn.cursor() as cur:
            cur.executemany(
                'insert into hadith_embeddings (hadith_id, model, embedding) values (%s, %s, %s::vector) '
                'on conflict (hadith_id) do update set model = excluded.model, embedding = excluded.embedding',
                [(IDMAP[r['hadith_id']], r['model'], r['v']) for r in rows if r['hadith_id'] in IDMAP])
        done += len(rows)
        print(f'{done}/{total}', flush=True)
print('ALL DONE', flush=True)
