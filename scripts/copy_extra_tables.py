"""Copy the source tables that are not defined in this repo (OCR extraction records) to the target.
Recreates each table from the source's column types, then copies all rows as JSON. Nothing is dropped on the target
beyond these tables. Requires TARGET_DB_URL in .target.env and the linked source project."""
import json, os, re, subprocess, time
import psycopg
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
url = re.match(r"^TARGET_DB_URL='(.+)'$", open(os.path.join(ROOT, '.target.env'), encoding='utf-8').read().strip(), re.S).group(1)
TABLES = ['documents', 'document_pages', 'extractions', 'index_extractions', 'introduction_extractions',
          'article_extractions', 'hadith_extractions', 'hadith_records', 'hadith_record_overrides']
def src(sql):
    last = ''
    for _ in range(4):
        out = subprocess.run(['supabase', 'db', 'query', '--linked', sql], capture_output=True, text=True, cwd=ROOT).stdout
        if '"rows"' in out:
            return json.loads(out[out.index('{'):out.rindex('}') + 1])['rows']
        last = out[-300:]; time.sleep(3)
    raise RuntimeError(last)
def ctype(c):
    if c['data_type'] == 'ARRAY':
        return c['udt_name'].lstrip('_') + '[]'
    if c['data_type'] == 'USER-DEFINED':
        return c['udt_name']
    return c['data_type']
with psycopg.connect(url, autocommit=True) as conn:
    for t in TABLES:
        cols = src(f"select column_name, data_type, udt_name, is_nullable from information_schema.columns where table_schema='public' and table_name='{t}' order by ordinal_position")
        ddl = ', '.join(f'"{c["column_name"]}" {ctype(c)}' + ('' if c['is_nullable'] == 'YES' else ' not null') for c in cols)
        conn.execute(f'create table if not exists public."{t}" ({ddl})')
        conn.execute(f'truncate public."{t}"')
        rows = src(f'select to_jsonb(x) as r from {t} x')
        if rows:
            payload = json.dumps([r['r'] for r in rows], ensure_ascii=False)
            conn.execute(f'insert into public."{t}" select * from jsonb_populate_recordset(null::public."{t}", %s::jsonb)', (payload,))
        n = conn.execute(f'select count(*) from public."{t}"').fetchone()[0]
        print(f'{t}: {n} rows (source {len(rows)})', flush=True)
print('ALL DONE', flush=True)
