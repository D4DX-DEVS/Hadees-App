"""Compare two page-file dirs (e.g. Sonnet vs Gemini): python3 -I diff_pages.py <dirA> <dirB> <first> <last> -> word-level differences per page."""
import json, re, sys, difflib, os
a, b, f, l = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
HAR = re.compile('[ؐ-ًؚ-ٰٟـ]')
def norm(t):
    t = HAR.sub('', t).replace('ള്ള', 'ളള').replace('‌', '').replace('‍', '')
    t = re.sub(r"[\"'‘’“”`´]+", '"', t)
    return t
def texts(p):
    ar, ml = [], []
    for blk in p['blocks']:
        t = blk.get('type')
        if t == 'arabic': ar.append(blk['text'])
        elif t in ('malayalam', 'footnote', 'note'): ml.append(blk['text'])
        elif t in ('bab', 'book_heading'): ar.append(blk.get('arabic') or ''); ml.append(blk.get('malayalam') or '')
    return norm(' '.join(ar)).split(), norm(' '.join(ml)).split()
PUNCT = re.compile(r'[\s.,;:!?\-\u2013\u2014()\[\]"\u060c\u061b\u00b9\u00b2\u00b3\u2070-\u2079\u2026*0-9]')
def trivial(x, y):
    return PUNCT.sub('', x) == PUNCT.sub('', y)
out = []
tot = 0
for n in range(f, l + 1):
    fa, fb = os.path.join(a, f'p{n:03d}.json'), os.path.join(b, f'p{n:03d}.json')
    if not (os.path.exists(fa) and os.path.exists(fb)): print(n, 'missing'); continue
    A, B = texts(json.load(open(fa))), texts(json.load(open(fb)))
    for kind, x, y in (('AR', A[0], B[0]), ('ML', A[1], B[1])):
        sm = difflib.SequenceMatcher(None, x, y, autojunk=False)
        d = []
        for t, i1, i2, j1, j2 in sm.get_opcodes():
            if t == 'equal': continue
            xs, ys = ' '.join(x[i1:i2]), ' '.join(y[j1:j2])
            if trivial(xs, ys): continue
            d.append((xs, ys))
            out.append({'pdf_page': n, 'kind': kind, 'a': xs, 'b': ys, 'context': ' '.join(x[max(0, i1 - 5):i2 + 5])})
        tot += len(d)
        print(f'p{n} {kind} sim={sm.ratio():.3f} diffs={len(d)}')
        for s, g in d[:40]: print(f'   A: {s}\n   B: {g}')
print('total diffs', tot)
if '--json' in sys.argv:
    json.dump(out, open(sys.argv[sys.argv.index('--json') + 1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
