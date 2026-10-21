"""Apply verifier corrections (ocr/<part>/corrections/*.json) to the page files.

usage: python3 -I scripts/apply_corrections.py <part> [--dry]

Each correction is an exact-substring replace inside one block; it is applied only if `old` occurs exactly once
in that block. Anything else is reported and skipped. Writes ocr/<part>/verified.json with the pages that were
checked and the hadith the verifier was unsure about; build.py then clears needs_review for verified pages
except for the uncertain hadith.
"""
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
part = sys.argv[1]
if part.startswith('art-'):      # prose: art-article / art-intro -> pages in ocr/v1/art/<name>/, corrections in ocr/v1/art/<name>_corr/
    name = part[4:]
    BASE = os.path.join(ROOT, 'ocr', 'v1', 'art', name + '_corr')
    pages_dir = os.path.join(ROOT, 'ocr', 'v1', 'art', name)
else:
    BASE = (os.path.join(ROOT, 'ocr', 'v1', part) if part.startswith('1.') else
            os.path.join(ROOT, 'ocr', 'v3', part) if part.startswith('3.') else os.path.join(ROOT, 'ocr', 'v4', part) if part.startswith('4.') else os.path.join(ROOT, 'ocr', part))
    pages_dir = os.path.join(BASE, 'pages')
dry = '--dry' in sys.argv
vpath = os.path.join(BASE, 'verified.json')
ver = json.load(open(vpath)) if os.path.exists(vpath) else {'pages': [], 'uncertain': [], 'applied': 0}

applied = skipped = 0
resolved = []
only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else '*'
for cf in sorted(glob.glob(os.path.join(BASE if part.startswith('art-') else os.path.join(BASE, 'corrections'), only + '.json'))):
    c = json.load(open(cf, encoding='utf-8'))
    by_page = {}
    for x in c.get('corrections', []):
        by_page.setdefault(x['pdf_page'], []).append(x)
    for n in c.get('pages_checked', []):
        if n not in ver['pages']:
            ver['pages'].append(n)
    for u in c.get('uncertain', []):
        if u not in ver['uncertain']:
            ver['uncertain'].append(u)
    # `resolved`: [{pdf_page, hadith_no}] re-checked at high zoom -> no longer unsure (hadith_no may be null)
    resolved.extend(c.get('resolved', []))
    for n, items in by_page.items():
        pf = os.path.join(pages_dir, f'p{n:03d}.json')
        page = json.load(open(pf, encoding='utf-8'))
        changed = False
        for x in items:
            blocks = page['blocks']
            if not (0 <= x['block'] < len(blocks)):
                print(f'SKIP p{n} block {x["block"]}: no such block'); skipped += 1; continue
            b = blocks[x['block']]
            fields = [k for k in ('text', 'arabic', 'malayalam') if isinstance(b.get(k), str) and x['old'] in b[k]]
            if not fields and b.get('rows') is not None:
                print(f'SKIP p{n} block {x["block"]}: table block'); skipped += 1; continue
            hits = sum(b[k].count(x['old']) for k in fields)
            if hits != 1:
                print(f'SKIP p{n} block {x["block"]}: old matched {hits}x'); skipped += 1; continue
            b[fields[0]] = b[fields[0]].replace(x['old'], x['new'], 1)
            changed = True; applied += 1
        if changed and not dry:
            page.setdefault('verified_by', 'claude-sonnet-5-5 diff check')
            json.dump(page, open(pf, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
ver['uncertain'] = [u for u in ver['uncertain'] if not any(
    u['pdf_page'] == r['pdf_page'] and u.get('hadith_no') == r.get('hadith_no') for r in resolved)]
ver['applied'] = ver.get('applied', 0) + (0 if dry else applied)
ver['pages'].sort()
if not dry:
    json.dump(ver, open(vpath, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{part}: applied {applied}, skipped {skipped}, verified pages {len(ver["pages"])}, uncertain notes {len(ver["uncertain"])}')
