"""Verify every hadith against the standard collections it cites (Arabic text, collection, number).
For each hadith and each cited collection: candidates = lexical best + embedding top-3; each is aligned word by word
with our Arabic (diacritics, brackets and extra chain words in the collection are ignored). Writes
data/verify/verification.json  {hadith_id: [{src, no, ratio, status, alt_nos, typos, omitted}...]}
Usage: verify_all.py <dataset dir> <embedding cache dir>   (run with the venv python: needs sentence-transformers)"""
import collections, difflib, json, os, re, sys
import numpy as np

D, CACHE = sys.argv[1], sys.argv[2]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = {'ബു': 'bukhari', 'മു': 'muslim', 'ദ': 'abudawud', 'ന': 'nasai', 'തു': 'tirmidhi', 'ജ': 'ibnmajah'}
H = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭـ]')
MAP = {'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي'}
SPLIT = re.compile('^(?:و|ف)?(?=ال)')


def words(t):
    t = re.sub(r'\([^)]*\)|\[[^\]]*\]', ' ', t)
    t = H.sub('', t)
    for a, b in MAP.items():
        t = t.replace(a, b)
    return re.sub(r'[^ء-ي ]', ' ', t).split()


def clean(t):
    return ' '.join(words(t))[:1200]


def lev(a, b):
    if abs(len(a) - len(b)) > 2:
        return 9
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[-1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


ext, ext_words, pool = {}, {}, {}
for code, name in FILES.items():
    d = json.load(open(f'{D}/{name}.json'))['hadiths']
    ids = [str(h['idInBook']) for h in d]
    for h in d:
        ext_words[(code, str(h['idInBook']))] = words(h['arabic'])
    pool[code] = (ids, np.load(os.path.join(CACHE, f'emb_{name}.npz'))['v'])

ours = json.load(open(f'{D}/ours.json'))
lex = collections.defaultdict(dict)
for r in json.load(open(f'{D}/result_all.json')):
    lex[r['hadith_id']][r['src']] = r

# embeddings of our texts (same model as the cached collection vectors)
qpath = os.path.join(CACHE, 'emb_ours.npz')
if os.path.exists(qpath) and np.load(qpath)['ids'].shape[0] == len(ours):
    q = np.load(qpath)['v']
else:
    from sentence_transformers import SentenceTransformer
    import torch
    model = SentenceTransformer('intfloat/multilingual-e5-small', device='mps' if torch.backends.mps.is_available() else 'cpu')
    model.max_seq_length = 256
    q = model.encode(['query: ' + clean(r['ar']) for r in ours], batch_size=64, normalize_embeddings=True, convert_to_numpy=True).astype(np.float32)
    np.savez(qpath, v=q, ids=np.array([r['id'] for r in ours]))

out, stats = {}, collections.Counter()
for r, vec in zip(ours, q):
    mine = words(r['ar'])
    res = []
    for code in r['sc']:
        if code not in pool:
            continue
        ids, mat = pool[code]
        sims = mat @ vec
        top = np.argsort(-sims)[:4]
        cands = {ids[i]: float(sims[i]) for i in top}
        l = lex[r['id']].get(code)
        if l and l['no'] is not None:
            cands.setdefault(str(l['no']), 0.0)
        scored = []
        for no, sim in cands.items():
            ew = ext_words[(code, no)]
            sm = difflib.SequenceMatcher(None, mine, ew, autojunk=False)
            hit = sum(b.size for b in sm.get_matching_blocks())
            scored.append((hit / max(1, len(mine)), sim, no, sm))
        scored.sort(key=lambda x: (-x[0], -x[1]))
        ratio, sim, no, sm = scored[0]
        alt = [s[2] for s in scored[1:] if s[0] >= ratio - 0.03 and s[0] >= 0.6]
        typos, omitted = [], 0
        ew = ext_words[(code, no)]
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op == 'replace':
                a, b = mine[i1:i2], ew[j1:j2]
                if len(a) == len(b):
                    for x, y in zip(a, b):
                        if lev(x, y) <= 2 and len(x) >= 3:
                            typos.append([x, y])
                        else:
                            omitted += 1
                else:
                    omitted += len(a)
            elif op == 'delete':
                omitted += i2 - i1
        if ratio >= 0.97 and not typos:
            status = 'exact'
        elif ratio >= 0.9 and not typos:
            status = 'close'
        elif typos and ratio >= 0.6:
            status = 'check_typo'
        elif ratio >= 0.6:
            status = 'partial'
        else:
            status = 'unverified'
        res.append({'src': code, 'no': no, 'ratio': round(ratio, 3), 'sim': round(sim, 3), 'status': status,
                    'alt_nos': alt, 'typos': typos[:8], 'omitted': omitted, 'len': len(mine)})
    out[r['id']] = res
    best = max(res, key=lambda x: x['ratio']) if res else None
    stats[best['status'] if best else 'no_candidate'] += 1
json.dump(out, open(os.path.join(ROOT, 'data/verify/verification.json'), 'w'), ensure_ascii=False)
print(dict(stats))
