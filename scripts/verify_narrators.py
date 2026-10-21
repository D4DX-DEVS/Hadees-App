"""Cross-check our narrator against the narrator named in the standard collections, for hadith whose Arabic text
matched a collection confidently (score>=0.8, margin>=0.2; see scratchpad match.py). Writes data/verify/narrator_check.json
and prints a summary. Only well-known companions are checked (English->Malayalam table = app/src/lib/synonyms.ts)."""
import ast, collections, gzip, json, re, sys, os

D = sys.argv[1]            # folder with <collection>.json and result_all.json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = {'ബു': 'bukhari', 'മു': 'muslim', 'ദ': 'abudawud', 'ന': 'nasai', 'തു': 'tirmidhi', 'ജ': 'ibnmajah'}


def latin_key(s):
    s = s.lower()
    s = re.sub(r'[^a-z ]', ' ', s)
    s = re.sub(r'\b(al|an|ad|ar|as|ash|at|az)\b', '', s)
    s = re.sub(r'\bbin\b', 'ibn', s)
    s = s.replace('ou', 'u').replace('oo', 'u').replace('ee', 'i').replace('aa', 'a').replace('ay', 'ai')
    s = re.sub(r'dh|th|kh|sh|gh', lambda m: m.group(0)[0], s)
    s = s.replace('h', '')
    s = re.sub(r'(.)\1+', r'\1', s)
    return re.sub(r'\s+', '', s)


# English name -> Malayalam stems, from the app's synonym table
ts = open(os.path.join(ROOT, 'app/src/lib/synonyms.ts'), encoding='utf-8').read()
nar = ts[ts.index('const NARRATORS'):]
table = {}
for m in re.finditer(r"\{ en: \[(.*?)\], narrators: \[(.*?)\] \}", nar):
    ens = ast.literal_eval('[' + m.group(1) + ']')
    mls = ast.literal_eval('[' + m.group(2) + ']')
    for e in ens:
        table[latin_key(e)] = mls


CHILLU = {'റ': 'ര', 'ർ': 'ര', 'ൻ': 'ന', 'ൽ': 'ല', 'ൾ': 'ള', 'ൺ': 'ണ'}


def fold(s):
    """consonant skeleton: no spaces/brackets/ZWNJ/vowel signs/viramas, chillus -> base letters, 'bin' -> 'ibn'"""
    s = re.sub(r'\(.*?\)|[()]', '', s or '').replace(chr(0x200c), '').replace(chr(0x200d), '')
    s = re.sub(r'\s+', '', s)
    s = re.sub(r'(?<=.)(ഇബ്നു|ഇബനു|ബിൻ|ബിനു|ബുനു)', 'ബ്നു', s)
    s = ''.join(CHILLU.get(c, c) for c in s)
    return re.sub('[' + chr(0x0d3e) + '-' + chr(0x0d4d) + chr(0x0d57) + chr(0x0d02) + chr(0x0d03) + ']', '', s)


hadiths = {h['id']: h for h in json.load(gzip.open(sorted(__import__('glob').glob(ROOT + '/backups/*/hadiths.json.gz'))[-1], 'rt'))}
ext = {}
for code, name in FILES.items():
    for h in json.load(open(f'{D}/{name}.json'))['hadiths']:
        try:
            narr = ast.literal_eval(h['english']).get('narrator', '') if isinstance(h['english'], str) else (h['english'] or {}).get('narrator', '')
        except Exception:
            narr = ''
        ext[(code, str(h['idInBook']))] = narr

matches = json.load(open(os.path.join(ROOT, 'data/verify/matches.json')))
res = [{'hadith_id': int(h), 'src': m['src'], 'no': m['no'], 'score': 1, 'margin': 1} for h, ms in matches.items() for m in ms[:1]]
out = collections.defaultdict(list)
seen = set()
for r in res:
    if r['score'] < 0.8 or r['margin'] < 0.2 or r['no'] is None:
        continue
    if r['hadith_id'] in seen:
        continue
    seen.add(r['hadith_id'])
    narr_en = ext.get((r['src'], str(r['no'])), '')
    clean = re.sub(r'\s+', ' ', narr_en).strip()
    clean = re.sub(r'^(it was narrated( that| from)?|narrated|from)\s+', '', clean, flags=re.I)
    clean = re.split(r'\b(?:reported|narrated|said|saying|told|that|from)\b|[:,(]', clean, flags=re.I)[0].strip()
    k = latin_key(clean)
    if k and k not in table:                      # "Aisha, Ummul Mu'minin" -> longest known name inside
        inside = [t for t in table if len(t) >= 4 and (t in k)]
        if inside:
            k = max(inside, key=len)
    mine = hadiths[r['hadith_id']].get('narrator_ml')
    row = {'hadith_id': r['hadith_id'], 'src': r['src'], 'ext_no': r['no'], 'ext_narrator': narr_en, 'ours': mine}
    if not narr_en or not k:
        out['no_external_narrator'].append(row)
    elif k not in table:
        out['unknown_name'].append(row)
    else:
        stems = [fold(x) for x in table[k]]
        f = fold(mine)
        (out['agree'] if any(f.startswith(x) for x in stems) else out['differ']).append(row)

json.dump(out, open(os.path.join(ROOT, 'data/verify/narrator_check.json'), 'w'), ensure_ascii=False, indent=1)
print('confident matches:', len(seen))
for k, v in out.items():
    print(f'{k}: {len(v)}')
