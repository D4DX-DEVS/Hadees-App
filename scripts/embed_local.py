"""Embed pending hadiths locally with BAAI/bge-m3 (same model + text as the worker's adminEmbed) and write
hadith_embeddings rows through the Supabase CLI. usage: python3 -I scripts/embed_local.py  (uses the venv in
/Volumes/Shameer/MacBook-d4-ceo/hadeeth-embed)"""
import json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SQL_DIR = os.path.join(ROOT, 'data/embed_local'); os.makedirs(SQL_DIR, exist_ok=True)
def cli(sql):
    out = subprocess.run(['supabase', 'db', 'query', '--linked', sql], capture_output=True, text=True, cwd=ROOT).stdout
    return json.loads(out[out.index('{'):out.rindex('}') + 1])
todo = cli('select id, text from hadiths_to_embed(5000)')['rows']
print('pending', len(todo), flush=True)
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('BAAI/bge-m3', local_files_only=True)
B = 16
for i in range(0, len(todo), B * 6):
    chunk = todo[i:i + B * 6]
    vecs = model.encode([t['text'] for t in chunk], batch_size=B, normalize_embeddings=True)
    vals = ','.join(f"({t['id']},'@cf/baai/bge-m3','[{','.join(f'{x:.6f}' for x in v)}]'::vector)" for t, v in zip(chunk, vecs))
    sql = ('insert into hadith_embeddings (hadith_id, model, embedding) values ' + vals +
           ' on conflict (hadith_id) do update set model=excluded.model, embedding=excluded.embedding;')
    path = os.path.join(SQL_DIR, f'chunk_{i // (B * 6):04d}.sql')
    open(path, 'w').write(sql)
    r = subprocess.run(['supabase', 'db', 'query', '--linked', '-f', path], capture_output=True, text=True, cwd=ROOT)
    print(i + len(chunk), 'ok' if r.returncode == 0 else ('FAIL ' + r.stderr[-200:]), flush=True)
print('remaining', cli('select count(*) n from hadiths_to_embed(100000)')['rows'][0]['n'], flush=True)
print('DONE', flush=True)
