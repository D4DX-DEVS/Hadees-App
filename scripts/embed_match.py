"""Embedding-based matching of our Arabic hadith text to the six standard collections (test run on N hadith).
Usage: embed_match.py <dataset dir> <venv cache dir> [N]
Compares with the lexical (4-gram) matching in <dataset dir>/result_all.json: baseline 'confident' = score>=0.8 & margin>=0.2.
Embedding model: intfloat/multilingual-e5-small (passage:/query: prefixes)."""
import collections, json, os, random, re, sys, time
import numpy as np
from sentence_transformers import SentenceTransformer

D, CACHE = sys.argv[1], sys.argv[2]
N = sys.argv[3] if len(sys.argv) > 3 else '1000'
FILES = {'ബു': 'bukhari', 'മു': 'muslim', 'ദ': 'abudawud', 'ന': 'nasai', 'തു': 'tirmidhi', 'ജ': 'ibnmajah'}
HARAKAT = re.compile('[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]')
PAREN = re.compile(r'\([^)]*\)|\[[^\]]*\]')


def clean(t):
    t = PAREN.sub(' ', t)
    t = HARAKAT.sub('', t)
    return re.sub(r'\s+', ' ', t).strip()[:1200]


model = SentenceTransformer('intfloat/multilingual-e5-small', device='mps' if __import__('torch').backends.mps.is_available() else 'cpu')
model.max_seq_length = 256


def embed(texts, prefix, bs=64):
    t0 = time.time()
    v = model.encode([prefix + x for x in texts], batch_size=bs, normalize_embeddings=True, show_progress_bar=False, convert_to_numpy=True)
    print(f'  embedded {len(texts)} in {time.time()-t0:.0f}s', flush=True)
    return v.astype(np.float32)


# external pool (cached on disk)
pool = {}
for code, name in FILES.items():
    f = os.path.join(CACHE, f'emb_{name}.npz')
    d = json.load(open(f'{D}/{name}.json'))['hadiths']
    ids = [str(h['idInBook']) for h in d]
    if os.path.exists(f):
        pool[code] = (ids, np.load(f)['v'])
    else:
        print('embedding', name, len(d), flush=True)
        v = embed([clean(h['arabic']) for h in d], 'passage: ')
        np.savez(f, v=v)
        pool[code] = (ids, v)

ours = json.load(open(f'{D}/ours.json'))
random.seed(11)
sample = ours if N == 'all' else random.sample(ours, int(N))
res = json.load(open(f'{D}/result_all.json'))
base = collections.defaultdict(dict)       # hadith_id -> src -> (no, score, margin)
for r in res:
    base[r['hadith_id']][r['src']] = (r['no'], r['score'], r['margin'])

q = embed([clean(r['ar']) for r in sample], 'query: ')
rows = []
for r, vec in zip(sample, q):
    best = None
    per = {}
    for code in r['sc']:
        if code not in pool:
            continue
        ids, mat = pool[code]
        sims = mat @ vec
        top = np.argsort(-sims)[:2]
        per[code] = (ids[top[0]], float(sims[top[0]]), float(sims[top[0]] - sims[top[1]]))
    base_ok = {c for c, (no, s, m) in base[r['id']].items() if s >= 0.8 and m >= 0.2}
    lex_no = {c: base[r['id']][c][0] for c in base_ok}
    rows.append({'id': r['id'], 'emb': per, 'lex_ok': sorted(base_ok), 'lex_no': lex_no})
json.dump(rows, open(os.path.join(D, f'embed_result_{N}.json'), 'w'), ensure_ascii=False)

# calibrate on pairs where lexical matching was confident (treated as ground truth)
truth = [(c, v) for r in rows for c, v in r['emb'].items() if c in r['lex_ok']]
agree = [(v[1], v[2], str(v[0]) == str(r['lex_no'][c])) for r in rows for c, v in r['emb'].items() if c in r['lex_ok']]
print('ground-truth pairs', len(agree), 'top1 agrees with lexical:', sum(a for *_, a in agree), f'({100*sum(a for *_, a in agree)/max(1,len(agree)):.0f}%)')
for sim_t, mar_t in [(0.9, 0.02), (0.88, 0.02), (0.86, 0.02), (0.84, 0.03), (0.82, 0.03)]:
    kept = [a for s, m, a in agree if s >= sim_t and m >= mar_t]
    prec = sum(kept) / max(1, len(kept))
    all_ok = {r['id'] for r in rows if any(v[1] >= sim_t and v[2] >= mar_t for v in r['emb'].values())}
    lex_ok = {r['id'] for r in rows if r['lex_ok']}
    print(f'sim>={sim_t} margin>={mar_t}: precision on truth {100*prec:.0f}% | hadith confident: embedding {len(all_ok)} / lexical {len(lex_ok)} / either {len(all_ok|lex_ok)} of {len(rows)}')
