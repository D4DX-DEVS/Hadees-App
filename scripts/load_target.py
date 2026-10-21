"""Run SQL files against the target database (TARGET_DB_URL in .target.env) with psycopg.
Logs each file, stops at the first error. usage: <venv>/bin/python scripts/load_target.py [files...]
With no arguments it loads the full data set in order: seeds, article seeds, fixups."""
import glob, os, re, sys, time
import psycopg
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
url = re.match(r"^TARGET_DB_URL='(.+)'$", open(os.path.join(ROOT, '.target.env'), encoding='utf-8').read().strip(), re.S).group(1)
def vkey(p):
    m = re.match(r'seed_(\d+)\.(\d+)\.sql$', os.path.basename(p))
    return (int(m.group(1)), int(m.group(2))) if m else (99, 0)
if len(sys.argv) > 1:
    files = sys.argv[1:]
else:
    files = [os.path.relpath(p, ROOT) for p in sorted(glob.glob(os.path.join(ROOT, 'supabase/seed_[0-9]*.sql')), key=vkey)]
    files += ['supabase/seed_articles.sql', 'supabase/seed_articles_v4.sql', 'supabase/fixups_v1.sql',
              'supabase/fixups_malayalam_1.sql', 'supabase/fixups_malayalam_2.sql', 'supabase/fixups_print_check.sql',
              'supabase/fixups_source_codes.sql']
    files += [f'supabase/fixups_text_corrections{s}.sql' for s in ['', '_2', '_3', '_4', '_5', '_6', '_7', '_8', '_9']]
    files += ['supabase/flag_held_vol4.sql']
with psycopg.connect(url, autocommit=True, connect_timeout=30) as conn:
    for f in files:
        path = f if os.path.isabs(f) else os.path.join(ROOT, f)
        if not os.path.exists(path):
            print('SKIP missing', f, flush=True); continue
        t = time.time()
        try:
            conn.execute(open(path, encoding='utf-8').read())
            print(f"{f} OK {time.time() - t:.1f}s", flush=True)
        except Exception as e:
            print(f"{f} FAIL {time.time() - t:.1f}s {str(e).replace(url, '<url>')[:300]}", flush=True)
            sys.exit(1)
print('ALL DONE', flush=True)
