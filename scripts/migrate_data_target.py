"""Load the hadith seeds, article seeds and fixups into the target database (TARGET_DB_URL in .target.env).
Stops at the first error and logs progress. usage: python3 -I scripts/migrate_data_target.py"""
import glob, os, re, subprocess, sys, time
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
url = re.match(r"^TARGET_DB_URL='(.+)'$", open(os.path.join(ROOT, '.target.env'), encoding='utf-8').read().strip(), re.S).group(1)
def vkey(path):
    m = re.match(r'seed_(\d+)\.(\d+)\.sql$', os.path.basename(path))
    return (int(m.group(1)), int(m.group(2))) if m else (99, 0)
seeds = sorted(glob.glob(os.path.join(ROOT, 'supabase/seed_[0-9]*.sql')), key=vkey)
files = [os.path.relpath(p, ROOT) for p in seeds]
files += ['supabase/seed_articles.sql', 'supabase/seed_articles_v4.sql']
files += ['supabase/fixups_v1.sql', 'supabase/fixups_malayalam_1.sql', 'supabase/fixups_malayalam_2.sql',
          'supabase/fixups_print_check.sql', 'supabase/fixups_source_codes.sql']
files += [f'supabase/fixups_text_corrections{s}.sql' for s in ['', '_2', '_3', '_4', '_5', '_6', '_7', '_8', '_9']]
files += ['supabase/flag_held_vol4.sql']
for f in files:
    if not os.path.exists(os.path.join(ROOT, f)):
        print('SKIP missing', f, flush=True); continue
    t = time.time()
    r = subprocess.run(['psql', url, '-v', 'ON_ERROR_STOP=1', '-q', '-f', os.path.join(ROOT, f)], capture_output=True, text=True)
    msg = (r.stderr or '').replace(url, '<url>').strip()[:300]
    print(f"{f} {'OK' if r.returncode == 0 else 'FAIL'} {time.time() - t:.1f}s {msg if r.returncode else ''}", flush=True)
    if r.returncode:
        sys.exit(1)
print('ALL DONE', flush=True)
