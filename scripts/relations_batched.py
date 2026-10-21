"""Recompute hadith_relations / group_id in id-range batches (avoids the Management API statement timeout).

usage: python3 -I scripts/relations_batched.py [batch_size=150] [resume_from_id]
(resume_from_id: continue an interrupted run without deleting the relations already computed)
needs: supabase CLI linked to the project, matn_core() + hadiths_matn_trgm from supabase/schema.sql
"""
import json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BATCH = int(sys.argv[1]) if len(sys.argv) > 1 else 150
RESUME = int(sys.argv[2]) if len(sys.argv) > 2 else None


def run(sql):
    with tempfile.NamedTemporaryFile('w', suffix='.sql', delete=False) as f:
        f.write(sql)
    r = subprocess.run(['supabase', 'db', 'query', '--linked', '-f', f.name], capture_output=True, text=True, cwd=ROOT)
    os.unlink(f.name)
    out = r.stdout + r.stderr
    errs = [l for l in out.splitlines() if '"_tag":"Error"' in l and 'PostHog' not in l]   # CLI telemetry warnings are harmless
    if errs:
        raise SystemExit('SQL failed: ' + errs[-1][-400:])
    try:
        return json.loads(r.stdout[r.stdout.index('{'):]).get('rows', [])
    except Exception:
        return []


lo, hi = run('select min(id) lo, max(id) hi from hadiths')[0].values()
lo, hi = min(lo, hi), max(lo, hi)
print('hadith id range', lo, hi)
if RESUME is None:
    run('delete from hadith_relations where not verified')
for start in range(RESUME or lo, hi + 1, BATCH):
    end = start + BATCH - 1
    run(f"""begin;
set local pg_trgm.similarity_threshold = 0.45;
insert into hadith_relations (hadith_id, related_id, relation, score)
select a.id, m.id, case when m.s >= 0.75 then 'duplicate' when m.s >= 0.55 then 'variant' else 'partial' end, m.s
from hadiths a
cross join lateral (
  select b.id, similarity(matn_core(b.arabic_text), matn_core(a.arabic_text)) s
  from hadiths b
  where b.id > a.id and matn_core(b.arabic_text) % matn_core(a.arabic_text)
) m
where a.id between {start} and {end}
on conflict (hadith_id, related_id) do nothing;
commit;""")
    n = run('select count(*) n from hadith_relations')[0]['n']
    print(f'ids {start}-{end}: relations so far {n}', flush=True)

run("""update hadiths set group_id = null;
with recursive edges as (
  select hadith_id a, related_id b from hadith_relations where relation in ('duplicate','variant')
  union select related_id, hadith_id from hadith_relations where relation in ('duplicate','variant')
), reach(start, node) as (
  select a, a from edges
  union
  select r.start, e.b from reach r join edges e on e.a = r.node
)
update hadiths h set group_id = g.gid from (select start, min(node) gid from reach group by start) g where h.id = g.start;""")
print(run("select relation, count(*) n from hadith_relations group by 1"))
print(run("select count(distinct group_id) groups from hadiths"))
print(run("""select count(*) cross_book from hadith_relations r join hadiths a on a.id=r.hadith_id
 join hadiths b on b.id=r.related_id where a.book_id<>b.book_id"""))
