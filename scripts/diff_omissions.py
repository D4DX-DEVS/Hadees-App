"""For hadith whose differences from the standard collections are omissions/additions (not 1:1 word swaps),
list the omitted/added words with context so a reader can decide if the meaning changes.
Writes data/verify/omissions.json. Usage: diff_omissions.py <dataset dir>"""
import collections, csv, difflib, glob, gzip, json, os, re, sys

exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'propose_corrections_relaxed.py')).read().split("b = sorted(glob.glob(ROOT + '/backups/*'))[-1]")[0])

R = ROOT
S = '/private/tmp/claude-501/-Users-d4-ceo-Desktop-hadeeth/0541cf70-ead2-4842-8c11-d3798fd868dd/scratchpad/audit2/'
b = sorted(glob.glob(R + '/backups/*'))[-1]
H8 = {str(h['id']): h for h in json.load(gzip.open(b + '/hadiths.json.gz', 'rt'))}
st = {r[0]: r for r in list(csv.reader(open(R + '/data/verify/arabic_final_status.csv', encoding='utf-8-sig')))[1:]}
corr = set()
for f in glob.glob(R + '/data/verify/corrections_applied*.json'):
    corr |= {str(x['id']) for x in json.load(open(f))}
prop = json.load(open(R + '/data/verify/corrections_proposed_relaxed.json'))
reviewed = {str(p['id']) for p in prop}          # these were looked at by the substitution reviews
todo = [h for h, r in st.items() if r[4] in ('BOOK_DIFFERS_FROM_SOURCES', 'MINOR_VARIANT_UNREVIEWED') and h not in corr and h not in reviewed]
print('hadith to analyse', len(todo), flush=True)
multi = json.load(open(R + '/data/verify/multisource.json'))
out = {}
for hid in todo:
    per = multi.get(hid)
    if not per:
        continue
    code, x = min(per.items(), key=lambda kv: kv[1]['n_unsupported'] / kv[1]['len'])
    text = H8[hid]['arabic_text']
    rr = runs(text)
    mine = [t[0] for t in rr]
    ops = collections.defaultdict(dict)       # (type, i1, words) -> source -> source raw words
    best = None
    for label, (kind, data, idx) in sources[code].items():
        a = align(mine, kind, data, idx)
        if not a:
            continue
        hit, w, r, sm = a
        if best is None or hit > best[0]:
            best = (hit, w, r, sm, label)
        for op, i1, i2, j1, j2 in sm.get_opcodes():
            if op == 'insert' and i1 > 0 and i2 == i1 and j1 > 0:        # source has words that ours lacks, inside our span
                key = ('omitted', i1, ' '.join(w[j1:j2]))
                ops[key][label] = ' '.join(r[j1:j2])
            elif op == 'delete':                                           # ours has words the source lacks
                key = ('added', i1, ' '.join(mine[i1:i2]))
                ops[key][label] = ' '.join(rr[k][1] for k in range(i1, i2))
            elif op == 'replace' and (i2 - i1) != (j2 - j1):
                key = ('rewritten', i1, ' '.join(w[j1:j2]))
                ops[key][label] = ' '.join(r[j1:j2])
    items = []
    for (typ, i1, words), srcs in ops.items():
        if len(srcs) < 2:
            continue
        # context in our text
        ctx = ' '.join(rr[k][1] for k in range(max(0, i1 - 5), min(len(rr), i1 + 6)))
        n = len(words.split())
        if n > 25:
            continue
        items.append({'type': typ, 'ours_word_index': i1, 'words': next(iter(srcs.values())), 'our_context': ctx, 'sources': sorted(srcs)})
    if items:
        out[hid] = {'code': code, 'items': items}
json.dump(out, open(R + '/data/verify/omissions.json', 'w'), ensure_ascii=False)
tot = collections.Counter(i['type'] for v in out.values() for i in v['items'])
print('hadith with agreed omissions/additions', len(out), dict(tot))
