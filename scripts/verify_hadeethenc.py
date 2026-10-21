"""Cross-check our hadith against HadeethEnc (independent source): Arabic, Malayalam, attribution.
Run with the venv python. Usage: verify_hadeethenc.py <dataset dir (ours.json)>"""
import collections, difflib, gzip, glob, json, os, re, sys
import numpy as np
from sentence_transformers import SentenceTransformer
import torch

D = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
H = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭـ]')
MAP = {'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي'}


def words(t):
    t = re.sub(r'\([^)]*\)|\[[^\]]*\]', ' ', t)
    t = H.sub('', t)
    for a, b in MAP.items():
        t = t.replace(a, b)
    return re.sub(r'[^ء-ي ]', ' ', t).split()


he = [json.loads(l) for l in open(os.path.join(ROOT, 'data/verify/hadeethenc/hadith.jsonl'), encoding='utf-8')]
he = [h for h in he if h.get('ar')]
b = sorted(glob.glob(ROOT + '/backups/*'))[-1]
ours = {h['id']: h for h in json.load(gzip.open(b + '/hadiths.json.gz', 'rt'))}
rows = json.load(open(f'{D}/ours.json'))

model = SentenceTransformer('intfloat/multilingual-e5-small', device='mps' if torch.backends.mps.is_available() else 'cpu')
model.max_seq_length = 256
enc = lambda xs, p: model.encode([p + ' '.join(words(x))[:1200] if p != 'ml' else x for x in xs], batch_size=64, normalize_embeddings=True, convert_to_numpy=True)
hv = model.encode(['passage: ' + ' '.join(words(h['ar']))[:1200] for h in he], batch_size=32, normalize_embeddings=True, convert_to_numpy=True)
qv = model.encode(['query: ' + ' '.join(words(r['ar']))[:1200] for r in rows], batch_size=64, normalize_embeddings=True, convert_to_numpy=True)
sims = qv @ hv.T

# one-to-one-ish: for each HadeethEnc hadith find our best; keep both directions' agreement
best_for_he = sims.argmax(axis=0)
out, stats = [], collections.Counter()
for j, h in enumerate(he):
    i = int(best_for_he[j])
    r = rows[i]
    mine, theirs = words(r['ar']), words(h['ar'])
    sm = difflib.SequenceMatcher(None, mine, theirs, autojunk=False)
    hit = sum(x.size for x in sm.get_matching_blocks())
    ratio_ours = hit / max(1, len(mine))
    ratio_theirs = hit / max(1, len(theirs))
    out.append({'hen_id': h['id'], 'our_id': r['id'], 'sim': float(sims[i, j]), 'ratio_ours': round(ratio_ours, 3), 'ratio_theirs': round(ratio_theirs, 3),
                'attribution': h['attribution_ar'], 'grade': h['grade_ar'], 'our_sources': ours[r['id']].get('source_codes_ml')})
json.dump(out, open(os.path.join(ROOT, 'data/verify/hadeethenc/match.json'), 'w'), ensure_ascii=False)
good = [o for o in out if max(o['ratio_ours'], o['ratio_theirs']) >= 0.6]
print('HadeethEnc hadith', len(he), '| matched to one of ours (>=60% words either way):', len(good))
for t in (0.9, 0.8, 0.7, 0.6): print(f'  words >= {t}:', sum(max(o['ratio_ours'], o['ratio_theirs']) >= t for o in out))
