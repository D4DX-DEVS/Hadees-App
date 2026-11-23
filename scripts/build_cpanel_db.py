"""Build a self-contained SQL bundle (db-bundle/ + db-bundle.zip) that recreates the Hadees database on a plain PostgreSQL 15
server (e.g. cPanel) with pg_trgm, unaccent and vector. Stdlib only.

  schema   : supabase/*.sql in the order of docs/SUPABASE_MIGRATION.md, with the Supabase-only parts (roles anon /
             authenticated / service_role: GRANT, REVOKE, policy TO-clauses) removed. The HNSW index is built after the data.
  data     : the LIVE rows of every table, ids preserved, read from the Supabase project in app/.env through its public
             REST API (no secrets needed). Rows travel as JSON through jsonb_populate_recordset(), so types, arrays and
             jsonb round-trip exactly. Every data file is idempotent (ON CONFLICT DO NOTHING).
  vectors  : hadith_embeddings, read through the Supabase CLI (linked project, read-only), 200 rows per file. Resumable.
  verify   : 99_verify.sql returns row counts + md5 checksums; the same query is run on Supabase and saved as
             99_expected.txt so the two results can be compared.

usage: python -I scripts/build_cpanel_db.py [--skip-vectors] [--skip-verify]
Re-running reuses vector files that already exist."""
import glob, json, os, re, shutil, subprocess, sys, time, urllib.error, urllib.request, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SQL = os.path.join(ROOT, 'supabase')
OUT = os.path.join(ROOT, 'db-bundle')
ZIP = os.path.join(ROOT, 'db-bundle.zip')
SKIP_VECTORS = '--skip-vectors' in sys.argv
SKIP_VERIFY = '--skip-verify' in sys.argv

# Order matters: search_v2 reads the views chapter_stats/book_stats from app_api, and it drops app_api's 6-argument
# app_search. The live database has both app_search overloads, so app_api runs again after search_v2 (it is idempotent).
SCHEMA_FILES = ['schema', 'articles', 'narrators', 'narrator_groups', 'relations', 'cross_refs', 'search_norm', 'app_api',
                'search_v2', 'app_api', 'feedback']
# table -> (order-by for stable paging, rows per file). Parents first (foreign keys).
TABLES = [
    ('volumes', 'id', 2000), ('books', 'id', 2000), ('chapters', 'id', 2000), ('sources', 'code_ar', 2000),
    ('articles', 'id', 2000), ('article_blocks', 'id', 1000), ('hadiths', 'id', 400), ('hadith_variants', 'id', 1000),
    ('hadith_relations', 'hadith_id,related_id', 2000), ('narrators', 'id', 2000), ('narrator_spellings', 'spelling', 2000),
    ('narrator_groups', 'spelling', 2000),
]
SERIAL_TABLES = ['volumes', 'books', 'chapters', 'articles', 'article_blocks', 'hadiths', 'hadith_variants', 'narrators']

ROLE_STMT = re.compile(r'(?ims)^[ \t]*(?:grant|revoke)\b(?:(?!;).)*?\b(?:anon|authenticated|service_role)\b(?:(?!;).)*;[ \t]*\n?')
POLICY_TO = re.compile(r'(?is)(create policy\b[^;]*?)\s+to\s+(?:anon|authenticated)(?:\s*,\s*(?:anon|authenticated))*')
HNSW = re.compile(r'(?is)create index if not exists hadith_embeddings_hnsw\s+on hadith_embeddings using hnsw \(embedding vector_cosine_ops\);')


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def write(name, text):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


def read_env():
    env = {}
    for line in open(os.path.join(ROOT, 'app', '.env'), encoding='utf-8'):
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"\'')
    return env['EXPO_PUBLIC_SUPABASE_URL'].rstrip('/'), env['EXPO_PUBLIC_SUPABASE_ANON_KEY']


# ───────── schema ─────────
def adapt(sql):
    sql = ROLE_STMT.sub('', sql)
    sql = POLICY_TO.sub(r'\1', sql)
    return sql


def build_schema():
    hnsw = []
    for i, name in enumerate(SCHEMA_FILES, 1):
        sql = open(os.path.join(SQL, name + '.sql'), encoding='utf-8').read()
        if name == 'narrator_groups':  # keep only the DDL: the rows come from the live table
            sql = sql.split('truncate narrator_groups;')[0]
        sql = adapt(sql)
        hnsw += [h for h in HNSW.findall(sql) if h not in hnsw]
        sql = HNSW.sub('', sql)
        bad = re.findall(r'(?im)^.*\b(?:anon|authenticated|service_role)\b.*$', sql)
        if bad:
            log('WARNING role references left in', name, bad[:3])
        write(f'{i:02d}_schema_{name}.sql', sql)
    write('00_extensions.sql', 'create extension if not exists pg_trgm;\ncreate extension if not exists unaccent;\n'
                               'create extension if not exists vector;\n')
    return hnsw


# ───────── data over REST ─────────
URL = KEY = None


def rest(table, order, start, size):
    headers = {'apikey': KEY, 'Range-Unit': 'items', 'Range': f'{start}-{start + size - 1}'}
    if KEY.startswith('eyJ'):
        headers['Authorization'] = 'Bearer ' + KEY
    req = urllib.request.Request(f'{URL}/rest/v1/{table}?select=*&order={order.replace(",", ".asc,")}.asc', headers=headers)
    for attempt in range(5):
        try:
            return json.load(urllib.request.urlopen(req, timeout=120))
        except (urllib.error.URLError, TimeoutError) as e:
            log('retry', table, start, e)
            time.sleep(3 * (attempt + 1))
    raise SystemExit(f'giving up on {table} at {start}')


def tag_for(text):
    n = 0
    while True:
        tag = '$j' + ('x' * n) + '$'
        if tag not in text:
            return tag
        n += 1


def data_sql(table, rows):
    body = json.dumps(rows, ensure_ascii=False, separators=(',', ':'))
    tag = tag_for(body)
    return (f'insert into {table} select * from jsonb_populate_recordset(null::{table}, {tag}{body}{tag}::jsonb) '
            f'on conflict do nothing;\n')


def export_tables():
    counts = {}
    for idx, (table, order, per_file) in enumerate(TABLES):
        num = 20 + idx
        rows, start, part = [], 0, 0
        total = 0
        while True:
            chunk = rest(table, order, start, 1000)
            rows += chunk
            start += len(chunk)
            total += len(chunk)
            while len(rows) >= per_file or (len(chunk) < 1000 and rows):
                part += 1
                take, rows = rows[:per_file], rows[per_file:]
                write(f'{num}_data_{table}_{part:03d}.sql', data_sql(table, take))
                if not rows:
                    break
            if len(chunk) < 1000:
                break
        counts[table] = total
        log(f'{table}: {total} rows in {part} file(s)')
    # hadiths: keep stored values exactly (the write trigger would recompute search columns and updated_at)
    h = [t for t, _, _ in TABLES].index('hadiths')
    write(f'{20 + h}_data_hadiths_000_triggers_off.sql', 'alter table hadiths disable trigger user;\n')
    write(f'{20 + h}_data_hadiths_999_triggers_on.sql', 'alter table hadiths enable trigger user;\n')
    return counts


# ───────── vectors through the Supabase CLI ─────────
def cli_query(sql):
    npx = shutil.which('npx') or shutil.which('npx.cmd')
    if not npx:
        raise SystemExit('npx not found')
    last = ''
    for attempt in range(4):
        r = subprocess.run([npx, '--no-install', 'supabase', 'db', 'query', '--linked', '--read-only', sql],
                           capture_output=True, text=True, encoding='utf-8', cwd=ROOT)
        out = r.stdout
        if '{' in out and '"rows"' in out:
            return json.loads(out[out.index('{'):out.rindex('}') + 1])['rows']
        last = (out + r.stderr)[-300:]
        time.sleep(4 * (attempt + 1))
    raise SystemExit('supabase CLI query failed: ' + last)


def export_vectors():
    last, part, total = 0, 0, 0
    while True:
        part += 1
        name = f'40_data_embeddings_{part:03d}.sql'
        path = os.path.join(OUT, name)
        if os.path.exists(path):  # resume: read the last id back from the file
            body = open(path, encoding='utf-8').read()
            ids = [int(x) for x in re.findall(r'"hadith_id":(\d+)', body)]
            last, total = max(ids), total + len(ids)
            continue
        rows = cli_query('select hadith_id, model, embedding::text as embedding, updated_at '
                         f'from hadith_embeddings where hadith_id > {last} order by hadith_id limit 200')
        if not rows:
            break
        write(name, data_sql('hadith_embeddings', rows))
        last = rows[-1]['hadith_id']
        total += len(rows)
        if part % 5 == 0:
            log(f'embeddings: {total} rows so far')
    log(f'embeddings: {total} rows in total')
    return total


# ───────── post-load, verify, loader ─────────
VERIFY = """select 'volumes' as t, count(*) as n, md5(string_agg(id::text || title_ml, '|' order by id)) as h from volumes
union all select 'books', count(*), md5(string_agg(id::text || volume_id || title_ml || coalesce(title_ar, ''), '|' order by id)) from books
union all select 'chapters', count(*), md5(string_agg(id::text || book_id || coalesce(title_ml, '') || coalesce(title_ar, ''), '|' order by id)) from chapters
union all select 'sources', count(*), md5(string_agg(code_ar || coalesce(name_ml, ''), '|' order by code_ar collate "C")) from sources
union all select 'articles', count(*), md5(string_agg(id::text || volume_id || title_ml, '|' order by id)) from articles
union all select 'article_blocks', count(*), md5(string_agg(id::text || article_id || kind || coalesce(text_ml, ''), '|' order by id)) from article_blocks
union all select 'hadiths', count(*), md5(string_agg(id::text || arabic_text || malayalam_text || coalesce(narrator_ml, '') || coalesce(group_id::text, ''), '|' order by id)) from hadiths
union all select 'hadith_variants', count(*), md5(string_agg(id::text || hadith_id || coalesce(malayalam_text, ''), '|' order by id)) from hadith_variants
union all select 'hadith_relations', count(*), md5(string_agg(hadith_id::text || related_id || relation || verified, '|' order by hadith_id, related_id)) from hadith_relations
union all select 'narrators', count(*), md5(string_agg(id::text || name_ml || coalesce(bio_ml, ''), '|' order by id)) from narrators
union all select 'narrator_spellings', count(*), md5(string_agg(spelling || narrator_id, '|' order by spelling collate "C", narrator_id)) from narrator_spellings
union all select 'narrator_groups', count(*), md5(string_agg(spelling || gkey || label, '|' order by spelling collate "C")) from narrator_groups
union all select 'hadith_embeddings', count(*), md5(string_agg(hadith_id::text || model, '|' order by hadith_id)) from hadith_embeddings
union all select 'functions', count(*), md5(string_agg(sig, ',' order by sig collate "C")) from (select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')) f
union all select 'views', count(*), md5(string_agg(viewname, ',' order by viewname collate "C")) from pg_views where schemaname = 'public'
order by 1;
"""

def build_post(hnsw):
    seq = ''.join(f"select setval(pg_get_serial_sequence('{t}', 'id'), coalesce((select max(id) from {t}), 1));\n"
                  for t in SERIAL_TABLES)
    write('90_post_load.sql', seq + '\n'.join(hnsw) + '\nanalyze;\n')


def build_verify():
    write('99_verify.sql', VERIFY)
    if SKIP_VERIFY:
        return
    log('running the verify query on Supabase (read-only)...')
    # the CLI returns only the first row when the statement contains line breaks, so send it on one line
    rows = cli_query(' '.join(VERIFY.split()).rstrip(';'))
    lines = ['t | n | h'] + [f"{r['t']} | {r['n']} | {r['h']}" for r in rows]
    write('99_expected.txt', '\n'.join(lines) + '\n')
    log('expected checksums saved:', ', '.join(f"{r['t']}={r['n']}" for r in rows))


def make_zip():
    if os.path.exists(ZIP):
        os.remove(ZIP)
    with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name in sorted(os.listdir(OUT)):
            info = zipfile.ZipInfo('db-bundle/' + name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o755 if name == 'load.sh' else 0o644) << 16
            with open(os.path.join(OUT, name), 'rb') as f:
                z.writestr(info, f.read(), compresslevel=9)
    log(f'wrote {ZIP}: {os.path.getsize(ZIP) / 1e6:.1f} MB')
    # small zip with only the schema + verify files, for fixing the schema on a server that already has the full bundle
    fix = os.path.join(ROOT, 'db-update.zip')
    with zipfile.ZipFile(fix, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name in sorted(os.listdir(OUT)):
            if re.match(r'(00_extensions|\d\d_schema_.+|99_.+|load\.sh)', name):
                info = zipfile.ZipInfo('db-bundle/' + name, date_time=(2026, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = (0o755 if name == 'load.sh' else 0o644) << 16
                with open(os.path.join(OUT, name), 'rb') as f:
                    z.writestr(info, f.read(), compresslevel=9)
    log(f'wrote {fix}: {os.path.getsize(fix) / 1e6:.2f} MB')


def main():
    global URL, KEY
    URL, KEY = read_env()
    os.makedirs(OUT, exist_ok=True)
    for f in glob.glob(os.path.join(OUT, '*')):  # keep vector files for resume, rebuild everything else
        if not os.path.basename(f).startswith('40_data_embeddings_'):
            os.remove(f)
    hnsw = build_schema()
    log('schema files written')
    export_tables()
    if not SKIP_VECTORS:
        export_vectors()
    build_post(hnsw)
    build_verify()
    write('load.sh', open(os.path.join(ROOT, 'scripts', 'cpanel_load.sh'), encoding='utf-8').read())
    make_zip()
    log('DONE')


main()
