"""Combine lexical (4-gram) and embedding matches into data/verify/matches.json.
A hadith/collection pair counts as matched when: lexical score>=0.8 and margin>=0.2, OR embedding top-1 margin>=0.02
AND >=80% of our Arabic words occur in the matched text. Usage: combine_matches.py <dataset dir> [embed_result file]"""
import collections, json, os, re, sys

D = sys.argv[1]
ER = sys.argv[2] if len(sys.argv) > 2 else os.path.join(D, 'embed_result_all.json')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = {'ബു': 'bukhari', 'മു': 'muslim', 'ദ': 'abudawud', 'ന': 'nasai', 'തു': 'tirmidhi', 'ജ': 'ibnmajah'}
H = re.compile('[ؐ-ًؚ-ٰٟۖ-ۭـ]')
MAP = {'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ى': 'ي', 'ة': 'ه', 'ؤ': 'و', 'ئ': 'ي'}


def words(t):
    t = re.sub(r'\([^)]*\)|\[[^\]]*\]', ' ', t)
    t = H.sub('', t)
    for a, b in MAP.items():
        t = t.replace(a, b)
    return re.sub(r'[^ء-ي ]', ' ', t).split()


ext = {c: {str(h['idInBook']): h['arabic'] for h in json.load(open(f'{D}/{n}.json'))['hadiths']} for c, n in FILES.items()}
ours = {r['id']: r for r in json.load(open(f'{D}/ours.json'))}
lex = collections.defaultdict(dict)
for r in json.load(open(f'{D}/result_all.json')):
    lex[r['hadith_id']][r['src']] = r
emb = {r['id']: r['emb'] for r in json.load(open(ER))}

out, stats = {}, collections.Counter()
for hid, o in ours.items():
    found = []
    for code in o['sc']:
        l = lex.get(hid, {}).get(code)
        if l and l['score'] >= 0.8 and l['margin'] >= 0.2 and l['no'] is not None:
            found.append({'src': code, 'no': str(l['no']), 'method': 'words', 'share': round(l['score'], 3)})
            continue
        e = emb.get(hid, {}).get(code)
        if e and e[2] >= 0.02:
            a = words(o['ar'])
            b = set(words(ext[code][str(e[0])]))
            share = sum(w in b for w in a) / max(1, len(a))
            if share >= 0.8:
                found.append({'src': code, 'no': str(e[0]), 'method': 'meaning', 'share': round(share, 3), 'sim': round(e[1], 3)})
    out[hid] = found
    stats['matched' if found else 'unmatched'] += 1
    for f in found:
        stats[f['method']] += 1
json.dump(out, open(os.path.join(ROOT, 'data/verify/matches.json'), 'w'), ensure_ascii=False)
print(dict(stats), 'of', len(ours))
