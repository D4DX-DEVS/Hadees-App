"""Propose Arabic corrections where our (printed) text has a typo that >=2 independent sources agree on.
Rule: for a word of ours, sunnah-dataset AND at least one OpenITI edition give the same different word at that position
(1:1 replacement, edit distance <=2), our word is rare in the six collections (<=3 hadith) and theirs is common (>=20).
Writes data/verify/corrections_proposed.json. Usage: propose_corrections.py <dataset dir>"""
import collections, difflib, gzip, glob, json, os, re, sys

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
MARKS = 'ؐ-ًؚ-ٰٟۖ-ۭـ'
H = re.compile('[' + MARKS + ']')
RUN = re.compile('[ء-ي' + MARKS + ']+')
MAP = {'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي'}
BOILER = re.compile(r'رضي\s+الله\s+(?:تعالى\s+)?عن(?:هما|ها|هم|هن|ه)|وفي\s+رواية|\b(?:حسن|صحيح|غريب|ضعيف)\b')
K = 4


def norm(w):
    w = H.sub('', w)
    for a, b in MAP.items():
        w = w.replace(a, b)
    return re.sub(r'[^ء-ي]', '', w)


def runs(text, drop_boiler=False):
    """[(normalised word, raw token, start, end)] outside brackets"""
    masked = re.sub(r'\([^)]*\)|\[[^\]]*\]', lambda m: ' ' * len(m.group(0)), text)
    out = []
    for m in RUN.finditer(masked):
        n = norm(m.group(0))
        if n:
            out.append((n, m.group(0), m.start(), m.end()))
    return out


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


def parag(path):
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
        else:
            cur.append(line[2:] if line.startswith('~~') else line)
    if cur:
        units.append(' '.join(cur))
    return units


def flat(units):
    W, R = [], []
    for u in units:
        for n, raw, *_ in runs(u):
            W.append(n)
            R.append(raw)
    idx = collections.defaultdict(list)
    for i in range(len(W) - K + 1):
        idx[' '.join(W[i:i + K])].append(i)
    return W, R, idx


def locate(mine, W, idx):
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
    bb = max(cnt, key=lambda b: sum(cnt.get(b + k, 0) for k in range(span + 1)))
    lo = max(0, bb * B - 16)
    return lo, lo + len(mine) + B * (span + 1) + 16


# sources
vocab = collections.Counter()
sources = {}
for code, name in DATASET.items():
    d = json.load(open(f'{D}/{name}.json'))['hadiths']
    docs = []
    for h in d:
        r = runs(h['arabic'])
        docs.append(([x[0] for x in r], [x[1] for x in r]))
        vocab.update(set(x[0] for x in r))
    idx = collections.defaultdict(list)
    for n, (w, _) in enumerate(docs):
        for g in {' '.join(w[i:i + K]) for i in range(max(0, len(w) - K + 1))}:
            idx[g].append(n)
    sources[code] = {'sunnah': ('unit', docs, idx)}
    for ed in EDITIONS[code]:
        W, R, ix = flat(parag(os.path.join(OI, ed)))
        sources[code]['JK' if 'JK' in ed else 'Shamela'] = ('flat', (W, R), ix)
    print(code, 'ready', flush=True)


def align(mine, kind, data, idx):
    if kind == 'unit':
        votes = collections.Counter()
        for g in {' '.join(mine[i:i + K]) for i in range(max(0, len(mine) - K + 1))}:
            for n in idx.get(g, ()):
                votes[n] += 1
        best = None
        for n, _ in votes.most_common(3):
            w, r = data[n]
            sm = difflib.SequenceMatcher(None, mine, w, autojunk=False)
            hit = sum(b.size for b in sm.get_matching_blocks())
            if not best or hit > best[0]:
                best = (hit, w, r, sm)
        return best
    W, R = data
    loc = locate(mine, W, idx)
    if not loc:
        return None
    lo, hi = loc
    w, r = W[lo:hi], R[lo:hi]
    sm = difflib.SequenceMatcher(None, mine, w, autojunk=False)
    return sum(b.size for b in sm.get_matching_blocks()), w, r, sm


b = sorted(glob.glob(ROOT + '/backups/*'))[-1]
H8 = {h['id']: h for h in json.load(gzip.open(b + '/hadiths.json.gz', 'rt'))}
ours = {r['id']: r for r in json.load(open(f'{D}/ours.json'))}
multi = json.load(open(os.path.join(ROOT, 'data/verify/multisource.json')))
cands = []
for hid, per in multi.items():
    if not per:
        continue
    code, x = min(per.items(), key=lambda kv: kv[1]['n_unsupported'] / kv[1]['len'])
    if not (1 <= x['n_unsupported'] <= 3):
        continue
    text = H8[int(hid)]['arabic_text']
    rr = runs(text)
    mine = [t[0] for t in rr]
    props = collections.defaultdict(dict)       # position -> source -> (their norm, their raw)
    for label, (kind, data, idx) in sources[code].items():
        a = align(mine, kind, data, idx)
        if not a:
            continue
        _, w, r, sm = a
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op == 'replace' and i2 - i1 == j2 - j1:
                for k in range(i2 - i1):
                    props[i1 + k][label] = (w[j1 + k], r[j1 + k])
    for pos, srcs in props.items():
        if 'sunnah' not in srcs or not ({'JK', 'Shamela'} & set(srcs)):
            continue
        theirs = srcs['sunnah'][0]
        agree = [s for s, (n, _) in srcs.items() if n == theirs]
        if len(agree) < 2 or 'sunnah' not in agree:
            continue
        o = mine[pos]
        if lev(o, theirs) > 2 or vocab[o] > 3 or vocab[theirs] < 20:
            continue
        if text[rr[pos][2]:rr[pos][3]].strip() == '':
            continue
        cands.append({'id': int(hid), 'code': code, 'pos': pos, 'ours': rr[pos][1], 'ours_norm': o, 'theirs_raw': srcs['sunnah'][1], 'theirs_norm': theirs,
                      'agree': agree, 'freq_ours': vocab[o], 'freq_theirs': vocab[theirs],
                      'context': text[max(0, rr[pos][2] - 25):rr[pos][3] + 25]})
json.dump(cands, open(os.path.join(ROOT, 'data/verify/corrections_proposed.json'), 'w'), ensure_ascii=False, indent=1)
print('proposals', len(cands), 'hadith', len({c['id'] for c in cands}))
