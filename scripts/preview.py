"""Build preview/index.html — a static mock of the hadith app reading the same data loaded into Supabase.

usage: python3 -I scripts/preview.py
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
hadiths = json.load(open(os.path.join(ROOT, 'data/hadiths.json'), encoding='utf-8'))
chapters = json.load(open(os.path.join(ROOT, 'data/chapters.json'), encoding='utf-8'))
relations = json.load(open(os.path.join(ROOT, 'data/relations.json'), encoding='utf-8'))
index = json.load(open(os.path.join(ROOT, 'ocr/index.json'), encoding='utf-8'))

data = {
    'books': [{'no': b['book_no'], 'title': b['title_ml'], 'page': b.get('start_page'),
               'chapters': len(b.get('chapters', []))} for b in index['books']],
    'chapters': [{'no': c['chapter_no'], 'ml': c['title_ml'], 'ar': c['title_ar'], 'page': c['start_page']}
                 for c in chapters],
    'hadiths': [{k: h[k] for k in ('hadith_no', 'arabic', 'malayalam', 'narrator_ml', 'source_codes_ar',
                                   'grading_note_ml', 'grading_note_ar', 'explanation_ml', 'variants',
                                   'bab_seq', 'page_start')} for h in hadiths],
    'relations': relations,
}

html = open(os.path.join(ROOT, 'scripts/preview_template.html'), encoding='utf-8').read()
os.makedirs(os.path.join(ROOT, 'preview'), exist_ok=True)
out = html.replace('/*__DATA__*/null', json.dumps(data, ensure_ascii=False).replace('</', '<\\/'))
open(os.path.join(ROOT, 'preview/index.html'), 'w', encoding='utf-8').write(out)
print('preview/index.html', len(out) // 1024, 'KB')
