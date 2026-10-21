"""Validate OCR page JSON files.  usage: python3 -I validate_pages.py <dir> <first_pdf_page> <last_pdf_page>"""
import json, os, re, sys

AR_CODE = re.compile(r'\(\s*[؀-ۿ]{1,3}\.?(?:\s*[,،]?\s*[؀-ۿ]{1,3}\.?)*\s*[,،]?\s*\)+\s*[.*]*\s*$')
TYPES = {'book_heading', 'bab', 'arabic', 'malayalam', 'footnote', 'note'}

d, first, last = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
errs, prev_no, offset = [], None, None
for n in range(first, last + 1):
    f = os.path.join(d, f'p{n:03d}.json')
    if not os.path.exists(f):
        errs.append(f'p{n:03d}: missing file'); continue
    try:
        p = json.load(open(f, encoding='utf-8'))
    except Exception as e:
        errs.append(f'p{n:03d}: invalid JSON: {e}'); continue
    if p.get('pdf_page') != n:
        errs.append(f'p{n:03d}: pdf_page={p.get("pdf_page")}')
    pp = p.get('printed_page')
    if not isinstance(pp, int):
        errs.append(f'p{n:03d}: printed_page missing')
    else:
        if offset is not None and pp - n != offset:
            errs.append(f'p{n:03d}: printed_page {pp} breaks offset {offset} (ok only if the scan skips/duplicates a page)')
        offset = pp - n
    if 'starts_mid_word' not in p:
        errs.append(f'p{n:03d}: starts_mid_word missing')
    blocks = p.get('blocks', [])
    if not blocks:
        errs.append(f'p{n:03d}: no blocks (blank page? add a note block)')
    for i, b in enumerate(blocks):
        t = b.get('type')
        if t not in TYPES:
            errs.append(f'p{n:03d} b{i}: unknown type {t}'); continue
        if t == 'arabic':
            no = b.get('hadith_no')
            if no is not None and not isinstance(no, int):
                errs.append(f'p{n:03d} b{i}: hadith_no not int')
            if no is None and i != 0:
                errs.append(f'p{n:03d} b{i}: hadith_no null but not first block')
            if isinstance(no, int):
                if prev_no is not None and no != prev_no + 1:
                    errs.append(f'p{n:03d}: hadith {no} after {prev_no}')
                prev_no = no
            nxt = blocks[i + 1]['type'] if i + 1 < len(blocks) else None
            if nxt != 'arabic' and not AR_CODE.search(b.get('text', '')[b.get('text', '').rfind('('):]) and not (i == len(blocks) - 1):
                errs.append(f'p{n:03d} hadith {no}: arabic text has no closing source code')
            if re.search(r'[ഀ-ൿ]', b.get('text', '')):
                errs.append(f'p{n:03d} hadith {no}: Malayalam letters inside arabic block')
        if t == 'malayalam' and re.search(r'[؀-ۿ]{4,}', b.get('text', '')):
            errs.append(f'p{n:03d} b{i}: long Arabic run inside malayalam block (check)')
        if t == 'bab' and not (b.get('arabic') or b.get('malayalam')):
            errs.append(f'p{n:03d} b{i}: empty bab')
print('\n'.join(errs) if errs else f'OK {first}-{last}')
