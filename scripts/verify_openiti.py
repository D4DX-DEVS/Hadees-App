"""Verify our Arabic against independent editions (OpenITI: Jawami' al-Kalim + Shamela) of the cited collections,
together with the sunnah.com-derived dataset. Per hadith and cited collection: best paragraph in each edition (4-gram votes), then a
word alignment. A word of ours is 'supported' if any source's best match contains it in alignment.
Output: data/verify/multisource.json. Usage: verify_openiti.py <dataset dir (ours.json, <collection>.json)>"""
import collections, difflib, json, os, re, sys

D = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OI = os.path.join(ROOT, 'data/verify/openiti')
EDITIONS = {
    'ബു': ['0256Bukhari.Sahih.JK000110-ara1.completed', '0256Bukhari.Sahih.Shamela0001681-ara1'],
    'മു': ['0261Muslim.Sahih.JK000109-ara1', '0261Muslim.Sahih.ShamAY0033938-ara2'],
    'ജ': ['0273IbnMaja.Sunan.JK000141-ara1', '0273IbnMaja.Sunan.Shamela0001198-ara1'],
    'ദ': ['0275AbuDawudSijistani.Sunan.JK000142-ara1', '0275AbuDawudSijistani.Sunan.Shamela0001726-ara1'],
    'തു': ['0279Tirmidhi.Sunan.JK000140-ara1.completed', '0279Tirmidhi.Sunan.Shamela0001435-ara1'],
    'ന': ['0303Nasai.SunanSughra.JK000130-ara1.mARkdown', '0303Nasai.SunanSughra.Shamela0000829-ara1'],
}
DATASET = {'ബു': 'bukhari', 'മു': 'muslim', 'ദ': 'abudawud', 'ന': 'nasai', 'തു': 'tirmidhi', 'ജ': 'ibnmajah'}
H = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭـ]')
MAP = {'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي'}
K = 4


def words(t):
    t = re.sub(r'\([^)]*\)|\[[^\]]*\]', ' ', t)
    t = H.sub('', t)
    for a, b in MAP.items():
        t = t.replace(a, b)
    return re.sub(r'[^ء-ي ]', ' ', t).split()


def paragraphs(path):
    units, cur = [], []
    for line in open(path, encoding='utf-8'):
        line = line.rstrip('\n')
        if line.startswith('#META#') or line.startswith('######OpenITI') or not line.strip():
            continue
        line = re.sub(r'PageV\d+P\d+', ' ', line)
        if line.startswith('#'):
            if cur:
                units.append(' '.join(cur))
            cur = [re.sub(r'^#+\s*(\$+|\|+|@[A-Z_]+@)?', '', line)]
        elif line.startswith('~~'):
            cur.append(line[2:])
        else:
            cur.append(line)
    if cur:
        units.append(' '.join(cur))
    return [words(u) for u in units if len(words(u)) >= 4]


def flat_build(units):
    W = [w for u in units for w in u]
    idx = collections.defaultdict(list)
    for i in range(len(W) - K + 1):
        idx[' '.join(W[i:i + K])].append(i)
    return W, idx


def flat_best(mine, W, idx):
    # find the stretch of the edition where most of our 4-grams occur (hadith may be split over several paragraphs)
    B = 32
    cnt = collections.Counter()
    for g in {' '.join(mine[i:i + K]) for i in range(max(0, len(mine) - K + 1))}:
        pos = idx.get(g, ())
        if len(pos) > 60:
            continue
        for p in pos:
            cnt[p // B] += 1
    if not cnt:
        return None
    span = len(mine) // B + 2
    best_b, best_v = None, 0
    for b in list(cnt):
        v = sum(cnt.get(b + k, 0) for k in range(span + 1))
        if v > best_v:
            best_b, best_v = b, v
    lo = max(0, best_b * B - 16)
    seg = W[lo: lo + len(mine) + B * (span + 1) + 16]
    sm = difflib.SequenceMatcher(None, mine, seg, autojunk=False)
    return sum(b.size for b in sm.get_matching_blocks()), sm


def build(units):
    idx = collections.defaultdict(list)
    for n, w in enumerate(units):
        for g in {' '.join(w[i:i + K]) for i in range(max(0, len(w) - K + 1))}:
            idx[g].append(n)
    return idx


def best_unit(mine, units, idx):
    votes = collections.Counter()
    for g in {' '.join(mine[i:i + K]) for i in range(max(0, len(mine) - K + 1))}:
        for n in idx.get(g, ()):
            votes[n] += 1
    if not votes:
        return None
    top = [n for n, _ in votes.most_common(3)]
    best = None
    for n in top:
        sm = difflib.SequenceMatcher(None, mine, units[n], autojunk=False)
        hit = sum(b.size for b in sm.get_matching_blocks())
        if not best or hit > best[0]:
            best = (hit, n, sm)
    return best


sources = {}
for code, eds in EDITIONS.items():
    sources[code] = []
    for name in eds:
        u = paragraphs(os.path.join(OI, name))
        sources[code].append(('JK' if 'JK' in name else 'Shamela', flat_build(u), None))
        print(code, name, len(u), flush=True)
    d = json.load(open(f'{D}/{DATASET[code]}.json'))['hadiths']
    u = [words(h['arabic']) for h in d]
    sources[code].append(('sunnah', u, build(u)))

BOILER = re.compile(r'رضي\s+الله\s+(?:تعالى\s+)?عن(?:هما|ها|هم|هن|ه)|وفي\s+رواية|\b(?:حسن|صحيح|غريب|ضعيف)\b')


def ours_words(t):
    # drop the book's own additions: companion honorifics, "in another narration", grading words
    t = re.sub(r'\([^)]*\)|\[[^\]]*\]', ' ', t)
    t = H.sub('', t)
    t = BOILER.sub(' ', t)
    return words(t)


ours = json.load(open(f'{D}/ours.json'))
out, stats = {}, collections.Counter()
for r in ours:
    mine = ours_words(r['ar'])
    if not mine:
        continue
    per = {}
    for code in r['sc']:
        if code not in sources:
            continue
        supported = [False] * len(mine)
        ratios = {}
        best_sm, best_hit, best_seg = None, -1, None
        for label, units, idx in sources[code]:
            if idx is None:
                fb = flat_best(mine, *units)
                if not fb:
                    ratios[label] = 0.0
                    continue
                hit, sm = fb
            else:
                b = best_unit(mine, units, idx)
                if not b:
                    ratios[label] = 0.0
                    continue
                hit, n, sm = b
            ratios[label] = round(hit / len(mine), 3)
            if hit > best_hit:
                best_sm, best_hit, best_label = sm, hit, label
            for blk in sm.get_matching_blocks():
                for k in range(blk.a, blk.a + blk.size):
                    supported[k] = True
        unsupported = [w for w, s in zip(mine, supported) if not s]
        pairs = []
        if best_sm is not None:
            for op, i1, i2, j1, j2 in best_sm.get_opcodes():
                if op == 'replace':
                    a, b2 = mine[i1:i2], best_sm.b[j1:j2]
                    if len(a) == len(b2):
                        pairs += [[x, y] for x, y in zip(a, b2) if not supported[mine.index(x)]] if False else [[x, y] for x, y in zip(a, b2)]
                    else:
                        pairs.append([' '.join(a), ' '.join(b2)])
                elif op == 'delete':
                    pairs.append([' '.join(mine[i1:i2]), ''])
        per[code] = {'pairs': pairs[:10], 'ratios': ratios, 'unsupported': unsupported[:12], 'n_unsupported': len(unsupported), 'len': len(mine)}
    out[r['id']] = per
    if per:
        c = min(per.values(), key=lambda x: x['n_unsupported'] / x['len'])
        agree = sum(v >= 0.9 for v in c['ratios'].values())
        stats['>=2 sources at 90%' if agree >= 2 else '1 source at 90%' if agree == 1 else 'none at 90%'] += 1
        stats['no unsupported word' if c['n_unsupported'] == 0 else '1-2 unsupported' if c['n_unsupported'] <= 2 else '3+ unsupported'] += 1
json.dump(out, open(os.path.join(ROOT, 'data/verify/multisource.json'), 'w'), ensure_ascii=False)
print(dict(stats))
