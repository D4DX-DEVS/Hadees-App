"""Diff two prose page dirs. usage: python3 -I diff_art.py <dirA> <dirB> <first> <last> [--json out]"""
import json, re, sys, difflib, os
a, b, f, l = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
HAR = re.compile('[ؐ-ًؚ-ٰٟـ]')
PUNCT = re.compile(r'[\s.,;:!?\-–—()\[\]"،؛¹²³⁰-⁹…*0-9]')
def norm(t):
    t = HAR.sub('', t).replace('ള്ള', 'ളള').replace('ന്മ', 'ൻമ').replace('‌', '').replace('‍', '')
    return re.sub(r"[\"'‘’“”`´]+", '"', t)
def texts(p):
    ar, ml = [], []
    for blk in p['blocks']:
        t = blk.get('type')
        if t == 'arabic': ar.append(blk['text'])
        elif t == 'table': ml.append(' '.join(' '.join(r) for r in blk['rows']))
        else: ml.append(blk.get('text') or '')
    return norm(' '.join(ar)).split(), norm(' '.join(ml)).split()
out, tot = [], 0
for n in range(f, l + 1):
    fa, fb = os.path.join(a, f'p{n:03d}.json'), os.path.join(b, f'p{n:03d}.json')
    if not (os.path.exists(fa) and os.path.exists(fb)): print(n, 'missing'); continue
    A, B = texts(json.load(open(fa))), texts(json.load(open(fb)))
    for kind, x, y in (('AR', A[0], B[0]), ('ML', A[1], B[1])):
        sm = difflib.SequenceMatcher(None, x, y, autojunk=False); cnt = 0
        for t, i1, i2, j1, j2 in sm.get_opcodes():
            if t == 'equal': continue
            xs, ys = ' '.join(x[i1:i2]), ' '.join(y[j1:j2])
            if PUNCT.sub('', xs) == PUNCT.sub('', ys): continue
            cnt += 1; out.append({'pdf_page': n, 'kind': kind, 'a': xs, 'b': ys, 'context': ' '.join(x[max(0, i1 - 5):i2 + 5])})
        tot += cnt
        print(f'p{n} {kind} sim={sm.ratio():.3f} diffs={cnt}')
print('total diffs', tot)
if '--json' in sys.argv:
    json.dump(out, open(sys.argv[sys.argv.index('--json') + 1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
