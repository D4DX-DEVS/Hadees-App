#!/usr/bin/env python3
"""Build supabase/seed_narrators.sql from the narrators article + spelling maps.
Inputs (data/narrators/): article_entries.json, auto_map.json, agent_map.json (optional), manual_map.json (optional)
Run:  python3 scripts/build_narrators.py && supabase db query --linked -f supabase/seed_narrators.sql
"""
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "data/narrators"
ARTICLE_ID = 15

def q(s):  # SQL string literal
    return "'" + s.replace("'", "''") + "'"

entries = json.load(open(D / "article_entries.json"))
maps = {}
for f in ("auto_map.json", "agent_map.json", "manual_map.json"):
    p = D / f
    if p.exists():
        for k, v in json.load(open(p)).items():
            if v:
                maps[k] = int(v)

extra = json.load(open(D / "extra_narrators.json")) if (D / "extra_narrators.json").exists() else []
ids = {e["number"] for e in entries} | {x["id"] for x in extra}
bad = {k: v for k, v in maps.items() if v not in ids}
assert not bad, f"unknown narrator ids: {list(bad.items())[:5]}"

def clean_name(n):
    return re.sub(r"\(റ\)\s*$", "", n.strip()).strip()

out = ["begin;", "delete from narrator_spellings;", "delete from narrators;"]
for e in entries:
    out.append(
        f"insert into narrators (id,name_ml,bio_ml,page,article_id,source_note) values "
        f"({e['number']},{q(clean_name(e['name']))},{q(re.sub(r'\\s+', ' ', e['bio']).strip())},{e['page'] or 'null'},{ARTICLE_ID},"
        f"{q('Printed page ' + str(e['page']) + ' · ചില പ്രധാന ഹദീസ് നിവേദകർ')});"
    )
for x in extra:  # narrators the book's list does not describe: no bio, but their hadith are still linked
    out.append(
        f"insert into narrators (id,name_ml,bio_ml,page,article_id,source_note) values "
        f"({x['id']},{q(x['name'])},{q(x.get('bio', ''))},{x.get('page') or 'null'},{x.get('article_id') or 'null'},{q(x['source_note']) if x.get('source_note') else 'null'});"
    )
rows = ",".join(f"({q(k)},{v})" for k, v in sorted(maps.items()))
out.append(f"insert into narrator_spellings (spelling,narrator_id) values {rows};")
out.append("commit;")
(ROOT / "supabase/seed_narrators.sql").write_text("\n".join(out), encoding="utf-8")
print(f"{len(entries)} narrators, {len(maps)} spellings")
