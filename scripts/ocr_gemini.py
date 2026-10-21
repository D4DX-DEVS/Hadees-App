"""OCR scanned book pages with a vision model through OpenRouter and write per-page JSON in the
format described in ocr/INSTRUCTIONS.md (same files the merge/validate/build scripts read).

usage:  python3 -I scripts/ocr_gemini.py <part> <first_page> <last_page> [--workers 6] [--force] [--out DIR]
        e.g. python3 -I scripts/ocr_gemini.py 2.7 1 104

needs:  OPENROUTER_API_KEY in the environment or in <project>/.env   (never commit .env)
        poppler's pdftoppm on PATH
"""
import base64, concurrent.futures as cf, json, os, re, subprocess, sys, tempfile, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = os.environ.get('OCR_MODEL', 'google/gemini-3.8-flash')
PDFS = {
    '2.2': 'vol 2.2 .pdf', '2.3': 'vol 2.3.pdf', '2.4': 'vol 2.4.pdf', '2.5': 'vol 2.5 (1).pdf',
    '2.6': 'vol 2.6.pdf', '2.7': 'vol 2.7.pdf', '2.8': 'vol 2.8.pdf', '2.9': 'Vol 2.9.pdf',
    '2.10': 'vol 2.10.pdf', '2.11': 'Vol 2.11.pdf', '2.12': 'vol 2.12.pdf', '2.13': 'Vol 2.13 .pdf',
    '2.14': 'vol 2.14.pdf',
    '2.2m': 'Vol 2 missing pages (190-191).pdf',     # the two pages missing from vol 2.2's scan
}
DL = os.path.expanduser('~/Downloads')


def api_key():
    k = os.environ.get('OPENROUTER_API_KEY')
    if not k:
        env = os.path.join(ROOT, '.env')
        if os.path.exists(env):
            for line in open(env, encoding='utf-8'):
                m = re.match(r'\s*OPENROUTER_API_KEY\s*=\s*(.+?)\s*$', line)
                if m:
                    k = m.group(1).strip('"\'')
    if not k:
        sys.exit('OPENROUTER_API_KEY not found (env var or .env in project root)')
    return k


PROSE = os.environ.get('PROSE') == '1'     # prose pages of Vol 1 (parts 'article' / 'intro'), see ocr/ARTICLES_V1.md
PROMPT = open(os.path.join(ROOT, 'ocr/ARTICLES_V1.md' if PROSE else 'ocr/INSTRUCTIONS.md'), encoding='utf-8').read() + """

---
You are given ONE scanned page image. Return ONLY the JSON object for that page (no markdown fences).
Use "pdf_page": %d. Transcribe exactly as printed; keep Arabic harakat; never invent text; mark
illegible spots with [?]. If the page is rotated, read it upright.
"""


def render(pdf, page, tmp):
    base = os.path.join(tmp, 'pg')
    subprocess.run(['pdftoppm', '-f', str(page), '-l', str(page), '-r', '200', '-jpeg', '-jpegopt', 'quality=88',
                    pdf, base], check=True)
    for f in os.listdir(tmp):
        if f.startswith('pg') and f.endswith('.jpg'):
            return os.path.join(tmp, f)
    raise RuntimeError('render failed')


def call(key, img_path, page):
    b64 = base64.b64encode(open(img_path, 'rb').read()).decode()
    body = json.dumps({
        'model': MODEL,
        'temperature': 0,
        'response_format': {'type': 'json_object'},
        'messages': [{'role': 'user', 'content': [
            {'type': 'text', 'text': PROMPT % page},
            {'type': 'image_url', 'image_url': {'url': 'data:image/jpeg;base64,' + b64}},
        ]}],
    }).encode()
    req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=body, headers={
        'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=300) as r:
        d = json.load(r)
    txt = d['choices'][0]['message']['content'].strip()
    txt = re.sub(r'^```(?:json)?|```$', '', txt, flags=re.M).strip()
    return json.loads(txt), d.get('usage', {})


def one(part, pdf, page, outdir, key, force):
    out = os.path.join(outdir, f'p{page:03d}.json')
    if os.path.exists(out) and not force:
        return page, 'skip', {}
    with tempfile.TemporaryDirectory() as tmp:
        img = render(pdf, page, tmp)
        for attempt in range(3):
            try:
                data, usage = call(key, img, page)
                data['pdf_page'] = page
                data.setdefault('starts_mid_word', False)
                data['ocr_model'] = MODEL
                json.dump(data, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
                return page, 'ok', usage
            except (urllib.error.URLError, json.JSONDecodeError, KeyError) as e:
                err = repr(e)
                time.sleep(3 * (attempt + 1))
        return page, 'FAILED ' + err[:120], {}


if __name__ == '__main__':
    args = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith('--') and sys.argv[i - 1] not in ('--out', '--workers')]
    part, first, last = args[0], int(args[1]), int(args[2])
    workers = int(sys.argv[sys.argv.index('--workers') + 1]) if '--workers' in sys.argv else 6
    force = '--force' in sys.argv
    pdf = (os.path.join(ROOT, 'src_v1', part + '.pdf') if (part.startswith('1.') or PROSE) else
           os.path.join(ROOT, 'src_v3', part + '.pdf') if part.startswith('3.') else os.path.join(DL, PDFS[part]))
    outdir = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else (os.path.join(ROOT, 'ocr', 'v3', part, 'pages') if part.startswith('3.') else os.path.join(ROOT, 'ocr', 'v1' if part.startswith('1.') else '', part, 'pages'))
    os.makedirs(outdir, exist_ok=True)
    key = api_key()
    tot = {'prompt_tokens': 0, 'completion_tokens': 0}
    with cf.ThreadPoolExecutor(workers) as ex:
        futs = [ex.submit(one, part, pdf, p, outdir, key, force) for p in range(first, last + 1)]
        for f in cf.as_completed(futs):
            page, status, usage = f.result()
            for k in tot:
                tot[k] += usage.get(k, 0)
            print(f'{part} p{page:03d}: {status}', flush=True)
    print('tokens', tot)
    print(f'now run: python3 -I scripts/validate_pages.py ocr/{part}/pages {first} {last}')
