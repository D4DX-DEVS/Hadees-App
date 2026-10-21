"""Apply the second-stage adjudicated word corrections (data/verify/adjudicated_fixes.json) -> supabase/fixups_text_corrections_' + TAG + '.sql"""
import glob, gzip, json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MARKS = 'ؐ-ًؚ-ٰٟۖ-ۭـ'
RUN = re.compile('[ء-ي' + MARKS + ']+')
MAP = {'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي'}


def norm(w):
    w = re.sub('[' + MARKS + ']', '', w)
    for a, b in MAP.items():
        w = w.replace(a, b)
    return re.sub(r'[^ء-ي]', '', w)


def runs(text):
    masked = re.sub(r'\([^)]*\)|\[[^\]]*\]', lambda m: ' ' * len(m.group(0)), text)
    return [(norm(m.group(0)), m.group(0), m.start(), m.end()) for m in RUN.finditer(masked) if norm(m.group(0))]


b = sorted(glob.glob(ROOT + '/backups/*'))[-1]
HD = {h['id']: h for h in json.load(gzip.open(b + '/hadiths.json.gz', 'rt'))}
SRC = sys.argv[1] if len(sys.argv) > 1 else 'adjudicated_fixes.json'
TAG = sys.argv[2] if len(sys.argv) > 2 else '5'
fixes = json.load(open(ROOT + '/data/verify/' + SRC))
by = {}
for f in fixes:
    by.setdefault(f['id'], []).append(f)
sql = ["alter table hadiths add column if not exists arabic_printed text;", "alter table hadiths add column if not exists correction_note text;"]
log, skipped = [], []
for i, fs in sorted(by.items()):
    t = HD[i]['arabic_text']
    r = runs(t)
    edits = []
    for f in fs:
        hits = [k for k, x in enumerate(r) if x[0] == f['ours_norm']]
        pick = f['pos'] if f['pos'] in hits else (hits[0] if len(hits) == 1 else None)
        if pick is None or any(pick == e[0] for e in edits):
            skipped.append((i, f['ours'], len(hits)))
            continue
        edits.append((pick, r[pick][2], r[pick][3], f['new'], f['reason']))
    if not edits:
        continue
    new = t
    for _, s, e, rep, _ in sorted(edits, key=lambda x: -x[1]):
        new = new[:s] + rep + new[e:]
    note = 'second-stage check (sources agree): ' + '; '.join(sorted({e[4] for e in edits}))[:300]
    sql.append(f"update hadiths set arabic_printed = coalesce(arabic_printed, arabic_text), arabic_text = $n${new}$n$, correction_note = coalesce(correction_note || '; ', '') || $c${note}$c$ where id = {i} and arabic_text = $o${t}$o$;")
    log.append({'id': i, 'edits': [{'old': t[s:e], 'new': rep, 'why': why} for _, s, e, rep, why in edits]})
open(ROOT + '/supabase/fixups_text_corrections_' + TAG + '.sql', 'w').write('\n'.join(sql) + '\n')
json.dump(log, open(ROOT + '/data/verify/corrections_applied_' + TAG + '.json', 'w'), ensure_ascii=False, indent=1)
print('hadith', len(log), 'edits', sum(len(l['edits']) for l in log), 'skipped', skipped)
