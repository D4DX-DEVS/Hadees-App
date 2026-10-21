"""Merge ocr/v3/_idx/{A,B,C}.json (index transcriptions by PDF page range) into ocr/v3/index.json."""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
secs = []
for tag in 'ABC':
    d = json.load(open(os.path.join(ROOT, 'ocr/v3/_idx', tag + '.json'), encoding='utf-8'))
    for s in d['sections']:
        if s.get('continues'):
            prev = secs[-1]
            if s.get('no') not in (None, prev['no']):
                raise SystemExit(f'{tag}: continuation no {s.get("no")} != previous section {prev["no"]}')
            prev['chapters'].extend(s['chapters'])
        else:
            secs.append({'no': s['no'], 'title_ml': s['title_ml'], 'page': s['page'], 'chapters': list(s.get('chapters', []))})
for s in secs:
    nos = [c['no'] for c in s['chapters']]
    assert nos == list(range(1, len(nos) + 1)), (s['no'], 'chapter numbering not consecutive')
    pages = [c['page'] for c in s['chapters']]
    dips = [(a, b) for a, b in zip(pages, pages[1:]) if b < a]
    if dips:
        print('section', s['no'], 'page dips (kept as printed):', dips)
json.dump({'volume': 3, 'sections': secs}, open(os.path.join(ROOT, 'ocr/v3/index.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(secs), 'sections,', sum(len(s['chapters']) for s in secs), 'chapters')
for s in secs:
    print(s['no'], s['title_ml'], s['page'], len(s['chapters']))
