"""Backfill hadiths.malayalam_search / narrator_search (trigger recomputes them on update) in id batches.
usage: python3 -I scripts/backfill_search.py [batch=500]"""
import json, os, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BATCH = int(sys.argv[1]) if len(sys.argv) > 1 else 500


def run(sql):
    with tempfile.NamedTemporaryFile('w', suffix='.sql', delete=False) as f:
        f.write(sql)
    r = subprocess.run(['supabase', 'db', 'query', '--linked', '-f', f.name], capture_output=True, text=True, cwd=ROOT)
    os.unlink(f.name)
    out = r.stdout + r.stderr
    if '"_tag":"Error"' in out:
        raise SystemExit('SQL failed: ' + out[-400:])
    try:
        return json.loads(r.stdout[r.stdout.index('{'):]).get('rows', [])
    except Exception:
        return []


lo, hi = list(run('select min(id) lo, max(id) hi from hadiths')[0].values())
for s in range(min(lo, hi), max(lo, hi) + 1, BATCH):
    run(f"update hadiths set malayalam_text = malayalam_text where id between {s} and {s + BATCH - 1} and malayalam_search is null;")
    print('ids', s, '-', s + BATCH - 1, flush=True)
print(run("select count(*) total, count(malayalam_search) filled from hadiths"))
