"""Copy narrator tables and hadith_relations from the linked source to the target (TARGET_DB_URL in .target.env).
narrators, narrator_spellings and narrator_groups are replaced in full; hadith_relations ids are mapped by
data/hadith_id_map.json (source id -> target id). Runs in one transaction per table."""
import json, os, re, subprocess, time
import psycopg
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
url = re.match(r"^TARGET_DB_URL='(.+)'$", open(os.path.join(ROOT, '.target.env'), encoding='utf-8').read().strip(), re.S).group(1)
IDMAP = {int(k): v for k, v in json.load(open(os.path.join(ROOT, 'data/hadith_id_map.json'))).items()}
def src(sql):
    out = subprocess.run(['supabase', 'db', 'query', '--linked', sql], capture_output=True, text=True, cwd=ROOT).stdout
    return json.loads(out[out.index('{'):out.rindex('}')+1])['rows']
with psycopg.connect(url, autocommit=False) as conn:
    cur = conn.cursor()
    # article ids differ between databases: map source id -> target id by (volume_id, section_no)
    src_art = src('select id, volume_id, section_no from articles')
    tgt_art = {(v, s_): i for i, v, s_ in cur.execute('select id, volume_id, section_no from articles').fetchall()}
    ARTMAP = {r['id']: tgt_art[(r['volume_id'], r['section_no'])] for r in src_art if (r['volume_id'], r['section_no']) in tgt_art}
    narrators = src('select id, name_ml, bio_ml, page, article_id, source_note from narrators order by id')
    cur.execute('truncate narrators restart identity cascade')
    cur.executemany('insert into narrators (id, name_ml, bio_ml, page, article_id, source_note) values (%s,%s,%s,%s,%s,%s)',
                    [(r['id'], r['name_ml'], r['bio_ml'], r['page'], ARTMAP.get(r['article_id']) if r['article_id'] else None, r['source_note']) for r in narrators])
    print('narrators', len(narrators), flush=True)
    spell = src('select spelling, narrator_id from narrator_spellings')
    cur.execute('truncate narrator_spellings')
    cur.executemany('insert into narrator_spellings (spelling, narrator_id) values (%s,%s) on conflict do nothing',
                    [(r['spelling'], r['narrator_id']) for r in spell])
    print('narrator_spellings', len(spell), flush=True)
    groups = src('select spelling, gkey, label from narrator_groups')
    cur.execute('truncate narrator_groups')
    cur.executemany('insert into narrator_groups (spelling, gkey, label) values (%s,%s,%s) on conflict do nothing',
                    [(r['spelling'], r['gkey'], r['label']) for r in groups])
    print('narrator_groups', len(groups), flush=True)
    rel = src('select hadith_id, related_id, relation, score, verified from hadith_relations')
    rows = []
    for r in rel:
        if r['hadith_id'] in IDMAP and r['related_id'] in IDMAP:
            a, b = sorted((IDMAP[r['hadith_id']], IDMAP[r['related_id']]))
            rows.append((a, b, r['relation'], r['score'], r['verified']))
    cur.execute('truncate hadith_relations')
    cur.executemany('insert into hadith_relations (hadith_id, related_id, relation, score, verified) values (%s,%s,%s,%s,%s)', rows)
    print('hadith_relations', len(rows), 'of', len(rel), flush=True)
    conn.commit()
print('ALL DONE', flush=True)
