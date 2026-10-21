"""Validate prose page JSON files: python3 -I validate_art.py <dir> <first_pdf_page> <last_pdf_page>"""
import json, os, sys
TYPES = {'heading', 'subheading', 'paragraph', 'arabic', 'list_item', 'table', 'footnote'}
d, first, last = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
errs, off = [], None
for n in range(first, last + 1):
    f = os.path.join(d, f'p{n:03d}.json')
    if not os.path.exists(f):
        errs.append(f'p{n:03d}: missing'); continue
    try:
        p = json.load(open(f, encoding='utf-8'))
    except Exception as e:
        errs.append(f'p{n:03d}: bad JSON {e}'); continue
    if p.get('pdf_page') != n: errs.append(f'p{n:03d}: pdf_page={p.get("pdf_page")}')
    pp = p.get('printed_page')
    if not isinstance(pp, int): errs.append(f'p{n:03d}: printed_page missing')
    else:
        if off is not None and pp - n != off: errs.append(f'p{n:03d}: printed_page {pp} breaks offset {off}')
        off = pp - n
    if 'starts_mid_word' not in p: errs.append(f'p{n:03d}: starts_mid_word missing')
    if not p.get('blocks'): errs.append(f'p{n:03d}: no blocks')
    for i, b in enumerate(p.get('blocks', [])):
        t = b.get('type')
        if t not in TYPES: errs.append(f'p{n:03d} b{i}: type {t}')
        elif t == 'table':
            if not b.get('rows'): errs.append(f'p{n:03d} b{i}: empty table')
        elif not (b.get('text') or '').strip(): errs.append(f'p{n:03d} b{i}: empty text')
print('\n'.join(errs) if errs else f'OK {first}-{last}')
