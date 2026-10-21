"""Final Arabic status per hadith -> data/verify/arabic_final_status.csv (+ not-confirmed list). Run after the verification steps."""
import collections, csv, glob, gzip, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = '/private/tmp/claude-501/-Users-d4-ceo-Desktop-hadeeth/0541cf70-ead2-4842-8c11-d3798fd868dd/scratchpad/audit2/'
b = sorted(glob.glob(ROOT + '/backups/*'))[-1]
H = {str(h['id']): h for h in json.load(gzip.open(b + '/hadiths.json.gz', 'rt'))}
B = {x['id']: x for x in json.load(gzip.open(b + '/books.json.gz', 'rt'))}
multi = json.load(open(ROOT + '/data/verify/multisource.json'))
tiers = json.load(open(ROOT + '/data/verify/arabic_tiers.json'))
corrected = {str(x['id']) for f in ('corrections_applied.json', 'corrections_applied_2.json') for x in json.load(open(ROOT + '/data/verify/' + f))} | {'15908', '16179', '17581', '16411', '17427'}
ours_ok = {'3703', '5018', '12654'}          # print has a typo, our text already has the correct form
human = {'580': 'printed page smudged where ours has [?]', '4675': 'ours has an extra third "rida nafsihi" item; print has two'}
verdict = {}
for f in glob.glob(S + '*out_*.json'):
    for x in json.load(open(f)):
        verdict[str(x['id'])] = x
flagged = set(tiers['3_review'])
for r in csv.reader(open(ROOT + '/data/verify/arabic_minor_differences.csv', encoding='utf-8-sig')):
    if r[-1] == 'likely_typo':
        flagged.add(r[0])
rows = []
cnt = collections.Counter()
for h, per in multi.items():
    if not per:
        status, detail = 'NO_SOURCE', 'cites no collection that we could compare'
    else:
        code, x = min(per.items(), key=lambda kv: kv[1]['n_unsupported'] / kv[1]['len'])
        n = x['n_unsupported']
        pairs = ' | '.join(f'{a} -> {c}' for a, c in x['pairs'][:6]) or ' '.join(x['unsupported'])
        v = verdict.get(h)
        if h in human:
            status, detail = 'NEEDS_HUMAN', human[h]
        elif h in corrected or h in ours_ok:
            status, detail = 'CONFIRMED', 'corrected / already correct'
        elif n == 0:
            status, detail = 'CONFIRMED', 'all words found in independent sources'
        elif h in flagged:
            if v is None:
                status, detail = 'PRINT_NOT_CHECKED', 'scan of this part not available yet; differs from sources: ' + pairs
            elif v['verdict'] == 'unreadable':
                status, detail = 'CUT_OFF_UNCHECKED', (v.get('note') or '')[:150] + ' | ' + pairs
            elif v['verdict'] == 'matches_print':
                status, detail = 'BOOK_DIFFERS_FROM_SOURCES', 'our text = printed text; sources differ: ' + pairs
            else:
                status, detail = 'NEEDS_HUMAN', str(v.get('errors'))[:200]
        else:
            status, detail = 'MINOR_VARIANT_UNREVIEWED', pairs
    cnt[status] += 1
    hd = H[h]; bk = B.get(hd['book_id'], {})
    rows.append([h, bk.get('volume_id'), bk.get('title_ml'), hd['hadith_no'], status, detail])
rows.sort(key=lambda r: (r[4], int(r[0])))
with open(ROOT + '/data/verify/arabic_final_status.csv', 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.writer(f)
    w.writerow(['hadith_id', 'volume', 'book', 'hadith_no', 'status', 'detail'])
    w.writerows(rows)
with open(ROOT + '/data/verify/arabic_not_confirmed.csv', 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.writer(f)
    w.writerow(['hadith_id', 'volume', 'book', 'hadith_no', 'status', 'detail'])
    w.writerows([r for r in rows if r[4] != 'CONFIRMED'])
print(dict(cnt), 'total', sum(cnt.values()))
