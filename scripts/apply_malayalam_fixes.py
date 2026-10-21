"""Apply unanimous (first reviewer + Opus + Gemini Flash) Malayalam corrections -> supabase/fixups_malayalam_' + TAG + '.sql.
Original book text kept in malayalam_printed; every update is guarded by the exact current text."""
import glob, gzip, json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
b = sorted(glob.glob(ROOT + '/backups/*'))[-1]
HD = {str(h['id']): h for h in json.load(gzip.open(b + '/hadiths.json.gz', 'rt'))}
TAG = sys.argv[2] if len(sys.argv) > 2 else '1'
WANT = (TAG == '1')  # '1' = first approved set, '2' = the later-approved extras
rows = [r for r in json.load(open(sys.argv[1])) if r['final'] == 'apply' and bool(r.get('approved_batch')) == WANT]
by = {}
for r in rows:
    by.setdefault(r['id'], []).append(r)
sql = ["alter table hadiths add column if not exists malayalam_printed text;",
       "alter table hadiths add column if not exists malayalam_correction_note text;"]
log, skipped = [], []
for i, fs in sorted(by.items(), key=lambda x: int(x[0])):
    t = HD[i]['malayalam_text']
    edits = []
    for f in fs:
        s = t.find(f['phrase'])
        if t.count(f['phrase']) != 1 or not f['first_fix'].strip() and False:
            skipped.append((i, f['phrase'], t.count(f['phrase']))); continue
        edits.append((s, s + len(f['phrase']), f['first_fix'], f['problem']))
    edits.sort()
    if any(edits[k][1] > edits[k + 1][0] for k in range(len(edits) - 1)):
        skipped.append((i, 'overlap', len(edits))); continue
    new = t
    for s, e, rep, _ in sorted(edits, reverse=True):
        new = new[:s] + rep + new[e:]
    if new == t: continue
    assert '$n$' not in new and '$o$' not in t and '$c$' not in new
    note = 'checked against Arabic by 3 independent reviewers (2026-10): ' + ' | '.join(e[3] for e in edits)[:400]
    sql.append(f"update hadiths set malayalam_printed = coalesce(malayalam_printed, malayalam_text), malayalam_text = $n${new}$n$, malayalam_correction_note = coalesce(malayalam_correction_note || '; ', '') || $c${note}$c$ where id = {i} and malayalam_text = $o${t}$o$;")
    log.append({'id': i, 'edits': [{'old': t[s:e], 'new': rep} for s, e, rep, _ in edits]})
open(ROOT + '/supabase/fixups_malayalam_' + TAG + '.sql', 'w').write('\n'.join(sql) + '\n')
json.dump(log, open(ROOT + '/data/verify/malayalam_corrections_applied_' + TAG + '.json', 'w'), ensure_ascii=False, indent=1)
print('hadith', len(log), 'edits', sum(len(l['edits']) for l in log), 'skipped', skipped)
