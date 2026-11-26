// Editor admin page: the extra libraries (Sunnah.com = schema sunnah, iHadis = schema ihadis), read-only, plus the
// editor's translations / corrections / topics on each of their hadith; and the Topics pages.
import { api, emptyState, h, icon, load, pageHead, pagedList, setQuery } from './core.js';
import { rowForm } from './forms.js';
import { go, setLeaveGuard } from './app.js';
import { extrasPanel, refHref } from './extras.js';

const n = (x) => Number(x || 0).toLocaleString();
const enc = encodeURIComponent;
const SRC = h.bind(null, 'a', { href: '#/src' }, 'Sources');
const IH_LANG = { en: 'English', ur: 'Urdu', bn: 'Bangla' };

/** grade text -> sahih | hasan | weak | unknown, the same rules as grade_class() in api.php */
export function gradeClass(g) {
  const t = String(g || '').toLowerCase();
  if (!t || /undetermined|not graded|unknown/.test(t)) return 'unknown';
  if (/da.?if|daif|weak|fabricat|mawdu|maudu|munkar|batil|shadh|matruk/.test(t)) return 'weak';
  if (/hasan/.test(t)) return 'hasan';
  if (/sahih|saheeh|authentic/.test(t)) return 'sahih';
  return 'unknown';
}
/** the optional grade of an encyclopedia hadith: value -> [English, Arabic] (hadiths_grade_check in api/editor-extras.sql) */
export const OWN_GRADES = {
  sahih: ['Sahih', 'صحيح', 'Authentic: unbroken chain of upright, precise narrators; no irregularity, no hidden defect. Accepted.'],
  sahih_li_ghairihi: ['Sahih li-ghairihi', 'صحيح لغيره', 'Hasan on its own, raised to sahih by other supporting chains. Accepted.'],
  hasan_sahih: ['Hasan Sahih', 'حسن صحيح', 'A term of at-Tirmidhi: judged both hasan and sahih (e.g. through two chains). Accepted.'],
  hasan: ['Hasan', 'حسن', 'Good: like sahih, but one narrator’s precision is a little lower. Accepted.'],
  hasan_li_ghairihi: ['Hasan li-ghairihi', 'حسن لغيره', 'Slightly weak on its own, raised to hasan by other chains. Accepted.'],
  daif: ['Da‘if (weak)', 'ضعيف', 'Weak: misses a condition of sahih or hasan. Not used for rulings.'],
  very_daif: ['Very weak', 'ضعيف جدا', 'Severely weak (e.g. a narrator accused of lying). Other chains do not raise it.'],
  mawdu: ['Mawdu‘ (fabricated)', 'موضوع', 'Fabricated, falsely attributed to the Prophet ﷺ. Not narrated except to warn.'],
};
export const GRADES = { sahih: ['Sahih', 'ok'], hasan: ['Hasan', 'info'], weak: ['Weak', 'bad'], unknown: ['Undetermined', 'warn'] };

/** a grade as a pill: colour from its class, the text always shown (who graded it stays: "Sahih · Al-Albani") */
export function gradePill(g, corrected = false) {
  if (!g) return h('span', { class: 'pill warn', title: 'No grade in the imported data' }, 'No grade');
  const text = String(g).replace(/\s*\(\s*([^)]+)\)\s*$/, ' · $1').replace(/\s+Hadith$/i, '').slice(0, 48);
  return h('span', { class: `pill ${GRADES[gradeClass(g)][1]}`, title: corrected ? `${g} (corrected by the editor)` : g },
    text, corrected ? ' · corrected' : '');
}

/** the grades of a collection / book as one stacked bar + counts; with link=true each count filters the list (?grade=) */
export function gradeSummary(counts, { link = false, current = '', unknownLabel = GRADES.unknown[0] } = {}) {
  const total = Object.values(counts || {}).reduce((a, b) => a + b, 0);
  if (!total) return null;
  const pct = (k) => (counts[k] / total) * 100;
  const chip = (k) => {
    const [label0, tone] = GRADES[k];
    const label = k === 'unknown' ? unknownLabel : label0;
    const body = [h('i', { class: `dot ${tone}` }), `${label} `, h('b', { class: 'num' }, Number(counts[k]).toLocaleString())];
    return link
      ? h('button', { type: 'button', class: `gchip${current === k ? ' on' : ''}`, 'aria-pressed': current === k ? 'true' : 'false', onclick: () => setQuery({ grade: current === k ? null : k }) }, body)
      : h('span', { class: 'gchip static' }, body);
  };
  return h('div', { class: 'grades' },
    h('div', { class: 'gbar', role: 'img', 'aria-label': Object.keys(GRADES).map((k) => `${GRADES[k][0]} ${counts[k]}`).join(', ') },
      Object.keys(GRADES).filter((k) => counts[k]).map((k) => h('i', { class: GRADES[k][1], style: `width:${pct(k)}%` }))),
    h('div', { class: 'gchips' },
      link ? h('button', { type: 'button', class: `gchip${current ? '' : ' on'}`, onclick: () => setQuery({ grade: null }) }, 'All ', h('b', { class: 'num' }, total.toLocaleString())) : null,
      Object.keys(GRADES).filter((k) => counts[k] || current === k).map(chip)));
}

/** a paged list of extra-library hadith with the grade filter above it (counts come with each page) */
/**
 * A paged list of hadith with the grade filter above it (counts come with each page).
 * opts: { own: true for encyclopedia hadith ("Not graded" instead of "Undetermined"; the bar hidden while nothing is graded), noun, onData }
 */
export function gradedList(action, params, item, empty, opts = {}) {
  const grade = new URLSearchParams(location.hash.split('?')[1] || '').get('grade') || '';
  const unknownLabel = opts.own ? 'Not graded' : GRADES.unknown[0];
  const head = h('div', { class: 'grade-slot' });
  const list = pagedList({ action, params: { ...params, ...(grade ? { grade } : {}) }, item, noun: opts.noun || 'hadith',
    empty: grade ? `No ${grade === 'unknown' ? unknownLabel.toLowerCase() : GRADES[grade]?.[0] ?? ''} hadith here.` : empty,
    onData: (res) => {
      opts.onData?.(res);
      const g = res.grades;
      // own hadith with no grade at all yet: no bar (it would only say "Not graded 100%")
      const none = opts.own && g && !grade && g.sahih + g.hasan + g.weak === 0;
      if (g) head.replaceChildren((none ? null : gradeSummary(g, { link: true, current: grade, unknownLabel })) || '');
    } });
  return h('div', {}, head, list);
}

const marks = (r) => [
  r.hidden ? h('span', { class: 'pill bad' }, 'Hidden') : null,
  r.edited ? h('span', { class: 'pill ok' }, 'Translated') : null,
  r.tagged ? h('span', { class: 'pill' }, 'Topics') : null,
];

const srcItem = (r) => h('a', { href: `#/src/h/${enc(r.urn)}` },
  h('span', { class: 'no' }, r.hadith_number || '—'),
  h('span', { class: 'txt' }, h('span', { class: 'snip en', style: 'display:block' }, r.snippet || '—'),
    h('span', { class: 'ref', style: 'display:block' }, `${r.collection} · book ${r.book_number}${r.chapter_number ? ' · chapter ' + r.chapter_number : ''}`)),
  h('span', { class: 'tags' }, ...marks(r), gradePill(r.grade, r.grade_fixed)));

const ihItem = (r) => h('a', { href: `#/src/ih/${enc(r.book_slug)}/${enc(r.hadith_id)}` },
  h('span', { class: 'no' }, r.hadith_id),
  h('span', { class: 'txt' }, h('span', { class: `snip ${r.lang === 'ur' ? 'ur' : ''}`, style: 'display:block', dir: r.lang === 'ur' ? 'rtl' : null }, r.snippet || '—'),
    h('span', { class: 'ref', style: 'display:block' }, `${r.book_slug} · ${IH_LANG[r.lang] || r.lang}`)),
  h('span', { class: 'tags' }, ...marks(r), gradePill(r.grade, r.grade_fixed)));

// ───────── sources home: both libraries + search ─────────
export function sourcesView(root, params) {
  const tab = params.get('tab') === 'ihadis' ? 'ihadis' : 'sunnah';
  const q = h('input', { type: 'search', placeholder: 'English words, or a number like “bukhari 52”', 'aria-label': 'Search the sources', value: params.get('q') || '' });
  const form = h('form', { class: 'row', role: 'search', onsubmit: (e) => {
    e.preventDefault();
    if (q.value.trim()) go(`#/src/find?src=${tab}&q=${enc(q.value.trim())}`);
  } }, h('div', { class: 'grow' }, q), h('button', { class: 'btn primary', type: 'submit' }, icon('search'), 'Search'));
  const tabs = h('div', { class: 'tabs', role: 'tablist' },
    [['sunnah', 'Sunnah.com'], ['ihadis', 'iHadis']].map(([k, label]) =>
      h('a', { href: `#/src?tab=${k}`, role: 'tab', class: k === tab ? 'on' : null, 'aria-selected': k === tab ? 'true' : 'false' }, label)));
  const box = h('div', { class: 'panel' });
  root.replaceChildren(
    pageHead({ title: 'Sources', sub: 'The hadith libraries imported from Sunnah.com and iHadis. Their text is never changed; your translations, corrections and topics are kept separately and survive a new import.' }),
    tabs, h('div', { class: 'toolbar' }, form), box);
  load(box, () => api('src_overview'), (d) => tab === 'sunnah'
    ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Collection'), h('th', { class: 'hide-sm' }, 'Arabic'), h('th', { class: 'num hide-sm' }, 'Books'), h('th', { class: 'num' }, 'Hadith'))),
      h('tbody', {}, d.collections.map((c) => h('tr', { onclick: () => go(`#/src/c/${enc(c.slug)}`) },
        h('td', {}, h('a', { class: 'id', href: `#/src/c/${enc(c.slug)}` }, c.name_en || c.slug), c.grp === 'nine' ? h('span', { class: 'pill', style: 'margin-left:8px' }, 'Nine books') : null),
        h('td', { class: 'ar hide-sm' }, c.name_ar || ''),
        h('td', { class: 'num hide-sm' }, n(c.book_count)),
        h('td', { class: 'num' }, n(c.hadiths)))))))
    : h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Book'), h('th', {}, 'Languages'), h('th', { class: 'num' }, 'Hadith'))),
      h('tbody', {}, d.ihadis.map((b) => h('tr', { onclick: () => go(`#/src/i/${enc(b.slug)}`) },
        h('td', {}, h('a', { class: 'id', href: `#/src/i/${enc(b.slug)}` }, b.title || b.slug), h('div', { class: 'small muted' }, b.slug)),
        h('td', {}, h('span', { class: 'row', style: 'gap:4px' }, pgArray(b.langs).map((l) => h('span', { class: 'pill' }, IH_LANG[l] || l)))),
        h('td', { class: 'num' }, n(b.hadiths))))))), 8);
}

/** grade filter without counts (search) */
const gradeTabs = (cur) => h('div', { class: 'gchips', style: 'margin-bottom:12px' },
  h('button', { type: 'button', class: `gchip${cur ? '' : ' on'}`, onclick: () => setQuery({ grade: null }) }, 'All grades'),
  Object.entries(GRADES).map(([k, [label, tone]]) => h('button', { type: 'button', class: `gchip${cur === k ? ' on' : ''}`, onclick: () => setQuery({ grade: cur === k ? null : k }) }, h('i', { class: `dot ${tone}` }), label)));

/** Postgres text[] arrives as "{en,ur}" through PDO */
const pgArray = (v) => (Array.isArray(v) ? v : String(v || '').replace(/^\{|\}$/g, '').split(',').filter(Boolean));

export function sourceFindView(root, params) {
  const src = params.get('src') === 'ihadis' ? 'ihadis' : 'sunnah';
  const qv = params.get('q') || '';
  const input = h('input', { type: 'search', value: qv, 'aria-label': 'Search words' });
  const pick = h('select', { 'aria-label': 'Library' }, [['sunnah', 'Sunnah.com'], ['ihadis', 'iHadis']].map(([k, l]) => h('option', { value: k, selected: k === src ? true : null }, l)));
  root.replaceChildren(
    pageHead({ crumbs: [SRC()], title: qv ? `“${qv}”` : 'Search the sources', sub: 'English words (all must appear), or a collection and number like “muslim 8”.' }),
    h('form', { class: 'toolbar row', role: 'search', onsubmit: (e) => { e.preventDefault(); setQuery({ q: input.value.trim(), src: pick.value }); } },
      h('div', { style: 'width:160px' }, pick), h('div', { class: 'grow' }, input), h('button', { class: 'btn primary', type: 'submit' }, icon('search'), 'Search')),
    qv.length >= 2
      ? h('div', {}, gradeTabs(params.get('grade') || ''),
        pagedList({ action: 'src_find', params: { q: qv, src, ...(params.get('grade') ? { grade: params.get('grade') } : {}) }, item: src === 'sunnah' ? srcItem : ihItem, noun: 'hadith', empty: 'Nothing found. Try other English words or another grade.' }))
      : h('div', { class: 'empty dash' }, 'Type at least 2 letters.'));
}

// ───────── Sunnah.com: collection → books → hadith ─────────
export function collectionView(root, slug) {
  const box = h('div');
  root.replaceChildren(box);
  load(box, () => api('src_books', { c: slug }), (d) => h('div', {},
    pageHead({ crumbs: [SRC(), h('a', { href: '#/src?tab=sunnah' }, 'Sunnah.com')], title: d.collection.name_en || slug,
      sub: `${n(d.books.length)} books · ${n(d.books.reduce((s, b) => s + b.hadiths, 0))} hadith` }),
    gradePanel(d.grades, 'Grades in this collection', 'The corrected grade if you set one, else the grade Sunnah.com prints, else the iHadis grade. Open a book to filter by grade.'),
    h('div', { class: 'panel table-wrap' }, d.books.length ? h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', { class: 'num', style: 'width:64px' }, 'Book'), h('th', {}, 'Title'), h('th', { class: 'hide-sm' }, 'Arabic'), h('th', { class: 'num' }, 'Hadith'))),
      h('tbody', {}, d.books.map((b) => {
        const href = `#/src/c/${enc(slug)}/${enc(b.book_number)}`;
        return h('tr', { onclick: () => go(href) },
          h('td', { class: 'num' }, h('a', { class: 'id', href }, b.book_number)),
          h('td', {}, b.name_en || '—'),
          h('td', { class: 'ar hide-sm' }, b.name_ar || ''),
          h('td', { class: 'num' }, n(b.hadiths)));
      }))) : emptyState('No books in this collection.'))), 8);
}

export function srcBookView(root, slug, book) {
  root.replaceChildren(
    pageHead({ crumbs: [SRC(), h('a', { href: `#/src/c/${enc(slug)}` }, slug)], title: `${slug} · book ${book}` }),
    gradedList('src_hadiths', { c: slug, b: book }, srcItem, 'No hadith in this book.'));
}

/** a panel with the grade bar of a collection / book */
const GRADE_MEANING = {
  sahih: 'Authentic: an unbroken chain of upright narrators with precise memory, no irregularity and no hidden defect. Accepted as evidence.',
  hasan: 'Good: like sahih, but one narrator’s precision is a little lower. Accepted as evidence. “Hasan Sahih” (at-Tirmidhi) is counted here.',
  weak: 'Weak: misses a condition of sahih or hasan (broken chain, weak or accused narrator). Includes very weak, munkar and fabricated (mawdu‘). Not used for rulings.',
  unknown: 'Undetermined: the imported data gives no grade, or says the grade could not be determined. Check with a scholar or set a corrected grade.',
};
/** a short explanation of the grades (folded) */
export const gradeMeanings = (unknownLabel) => h('details', { class: 'meanings' },
  h('summary', {}, 'What do the grades mean?'),
  h('dl', {}, Object.entries(GRADES).map(([k, [label, tone]]) => [
    h('dt', {}, h('i', { class: `dot ${tone}` }), k === 'unknown' && unknownLabel ? unknownLabel : label),
    h('dd', {}, k === 'unknown' && unknownLabel ? 'No grade has been set for this hadith in the editor.' : GRADE_MEANING[k])])));

const gradePanel = (counts, title, note) => {
  const g = gradeSummary(counts);
  return g ? h('div', { class: 'panel pad', style: 'margin-bottom:16px' }, h('div', { class: 'row', style: 'margin-bottom:10px' }, h('h2', {}, title), h('span', { class: 'small muted' }, note)), g, gradeMeanings()) : null;
};

/** read-only block of imported text */
const textBlock = (label, text, cls = '', dir = null) => (text ? h('div', { class: 'orig' }, h('div', { class: 'olabel' }, label), h('div', { class: cls, dir }, text)) : null);

function navPair(prev, next, href) {
  return h('span', { class: 'joined' },
    h(prev ? 'a' : 'button', { class: 'btn icon', href: prev ? href(prev) : null, disabled: prev ? null : true, 'aria-label': 'Previous hadith', title: 'Previous hadith' }, icon('left')),
    h(next ? 'a' : 'button', { class: 'btn icon', href: next ? href(next) : null, disabled: next ? null : true, 'aria-label': 'Next hadith', title: 'Next hadith' }, icon('right')));
}

export function srcHadithView(root, urn) {
  const box = h('div');
  root.replaceChildren(box);
  load(box, () => api('src_hadith', { urn }), (d) => {
    const r = d.row;
    const ex = extrasPanel({ ref: `s:${r.urn}`, data: d.extras, langs: ['ml', 'ur', 'en', 'ar'], flags: true, originalGrade: r.grade_en || r.ihadis_grade,
      originals: { en: r.text_en || '', ar: [r.sanad_ar, r.text_ar].filter(Boolean).join(' ') } });
    setLeaveGuard(ex.isDirty);
    const tr = d.translations.map((t) => textBlock(`${t.lang === 'urdu' ? 'Urdu' : t.lang === 'bangla' ? 'Bangla' : t.lang} (Sunnah.com)`, t.body, t.lang === 'urdu' ? 'ur' : '', t.lang === 'urdu' ? 'rtl' : null));
    return h('div', {},
      pageHead({ crumbs: [SRC(), h('a', { href: `#/src/c/${enc(r.collection)}` }, r.collection_name), h('a', { href: `#/src/c/${enc(r.collection)}/${enc(r.book_number)}` }, `Book ${r.book_number}`)],
        title: `${r.collection_name} ${r.hadith_number}`,
        sub: h('span', {}, [r.book_name, r.chapter_title].filter(Boolean).join(' › ') + ' ', gradePill(r.grade, r.grade_fixed)),
        actions: [r.url ? h('a', { class: 'btn ghost', href: r.url, target: '_blank', rel: 'noopener noreferrer' }, icon('external'), 'Sunnah.com') : null,
          navPair(d.prev, d.next, (u) => `#/src/h/${enc(u)}`)].filter(Boolean) }),
      h('div', { class: 'split' },
        h('div', { class: 'panel source-panel' },
          h('div', { class: 'ph' }, icon('book'), h('h2', {}, 'Imported text'), h('span', { class: 'meta' }, 'Read-only')),
          h('div', { class: 'pb' },
            textBlock('Arabic', [r.sanad_ar, r.text_ar].filter(Boolean).join(' '), 'ar', 'rtl'),
            textBlock('English', [r.narrator_en, r.text_en].filter(Boolean).join('\n'), 'en'),
            ...tr,
            textBlock('Footnote (Arabic)', r.footnote_ar, 'ar small-ar', 'rtl'),
            h('dl', { class: 'facts' },
              r.reference ? [h('dt', {}, 'Reference'), h('dd', {}, r.reference)] : null,
              r.in_book_reference ? [h('dt', {}, 'In book'), h('dd', {}, r.in_book_reference)] : null,
              [h('dt', {}, 'Grade (Sunnah.com)'), h('dd', {}, r.grade_en || h('span', { class: 'muted' }, 'not given'))],
              [h('dt', {}, 'Grade (iHadis)'), h('dd', {}, r.ihadis_grade || h('span', { class: 'muted' }, 'not given'))],
              r.grade_fixed ? [h('dt', {}, 'Corrected grade'), h('dd', {}, gradePill(r.grade, true))] : null,
              r.note_en ? [h('dt', {}, 'Note'), h('dd', {}, r.note_en)] : null),
            d.topics.length ? h('div', { class: 'orig' }, h('div', { class: 'olabel' }, 'Sunnah.com topics'), h('div', { class: 'chips' }, d.topics.map((t) => h('span', { class: 'chip plain' }, t.title)))) : null)),
        ex.el));
  }, 8);
}

// ───────── iHadis: book (one language) → chapter → hadith (all languages) ─────────
export function ihBookView(root, slug, params) {
  const box = h('div');
  root.replaceChildren(box);
  load(box, () => api('ih_book', { b: slug, lang: params.get('lang') || '' }), (d) => {
    const cur = d.books.find((b) => b.lang === d.lang) || d.books[0];
    return h('div', {},
      pageHead({ crumbs: [SRC(), h('a', { href: '#/src?tab=ihadis' }, 'iHadis')], title: cur.title || slug, titleClass: d.lang === 'ur' ? 'ur' : '',
        sub: `${n(cur.hadith_count)} hadith · ${n(d.chapters.length)} chapters${cur.publication ? ' · ' + cur.publication : ''}` }),
      gradePanel(d.grades, 'Grades in this book', `${IH_LANG[d.lang] || d.lang} edition, with your corrected grades. Open a chapter to filter by grade.`),
      h('div', { class: 'tabs', role: 'tablist' }, d.books.map((b) => h('a', { href: `#/src/i/${enc(slug)}?lang=${b.lang}`, role: 'tab', class: b.lang === d.lang ? 'on' : null }, IH_LANG[b.lang] || b.lang))),
      h('div', { class: 'panel table-wrap' }, d.chapters.length ? h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', { class: 'num', style: 'width:56px' }, 'No.'), h('th', {}, 'Chapter'), h('th', { class: 'num hide-sm' }, 'Range'), h('th', { class: 'num' }, 'Hadith'))),
        h('tbody', {}, d.chapters.map((c) => {
          const href = `#/src/i/${enc(slug)}/${c.chapter_id}?lang=${d.lang}`;
          return h('tr', { onclick: () => go(href) },
            h('td', { class: 'num' }, h('a', { class: 'id', href }, c.display_label || c.chapter_id)),
            h('td', { class: d.lang === 'ur' ? 'ur' : '', dir: d.lang === 'ur' ? 'rtl' : null }, c.title || '—'),
            h('td', { class: 'num hide-sm' }, c.hadith_range || ''),
            h('td', { class: 'num' }, n(c.hadiths)));
        }))) : emptyState('No chapters.')));
  }, 8);
}

export function ihChapterView(root, slug, ch, params) {
  const lang = params.get('lang') || 'en';
  root.replaceChildren(
    pageHead({ crumbs: [SRC(), h('a', { href: `#/src/i/${enc(slug)}?lang=${lang}` }, slug)], title: `${slug} · chapter ${ch}`, sub: IH_LANG[lang] || lang }),
    gradedList('ih_hadiths', { b: slug, ch, lang }, ihItem, 'No hadith in this chapter.'));
}

export function ihHadithView(root, slug, id) {
  const box = h('div');
  root.replaceChildren(box);
  load(box, () => api('ih_hadith', { b: slug, id }), (d) => {
    const first = d.rows[0];
    const en = d.rows.find((x) => x.lang === 'en');
    const arabic = d.rows.find((x) => x.arabic)?.arabic || '';
    const ex = extrasPanel({ ref: `i:${slug}/${id}`, data: d.extras, langs: ['ml', 'ur', 'en', 'ar'], flags: true, originalGrade: first.grade,
      originals: { en: en?.translation || '', ar: arabic } });
    setLeaveGuard(ex.isDirty);
    return h('div', {},
      pageHead({ crumbs: [SRC(), h('a', { href: `#/src/i/${enc(slug)}?lang=${first.lang}` }, first.book_title || slug),
        first.chapter_id ? h('a', { href: `#/src/i/${enc(slug)}/${first.chapter_id}?lang=${first.lang}` }, `Chapter ${first.chapter_id}`) : null].filter(Boolean),
        title: `${slug} ${first.display_label || id}`, sub: h('span', {}, `${d.rows.map((x) => IH_LANG[x.lang] || x.lang).join(' · ')} `,
          gradePill(d.extras.flag?.row.grade || first.grade, !!d.extras.flag?.row.grade)),
        actions: [navPair(d.prev, d.next, (x) => `#/src/ih/${enc(slug)}/${enc(x)}`)] }),
      h('div', { class: 'split' },
        h('div', { class: 'panel source-panel' },
          h('div', { class: 'ph' }, icon('book'), h('h2', {}, 'Imported text'), h('span', { class: 'meta' }, 'Read-only')),
          h('div', { class: 'pb' },
            textBlock('Arabic', arabic, 'ar', 'rtl'),
            ...d.rows.map((x) => textBlock(`${IH_LANG[x.lang] || x.lang}${x.narrator ? ' · ' + x.narrator : ''}`, x.translation, x.lang === 'ur' ? 'ur' : '', x.lang === 'ur' ? 'rtl' : null)),
            ...d.rows.filter((x) => x.note).map((x) => textBlock(`Note (${IH_LANG[x.lang] || x.lang})`, x.note, x.lang === 'ur' ? 'ur small' : 'small', x.lang === 'ur' ? 'rtl' : null)),
            h('dl', { class: 'facts' },
              [h('dt', {}, 'Grade (iHadis)'), h('dd', {}, first.grade || h('span', { class: 'muted' }, 'not given'))],
              d.extras.flag?.row.grade ? [h('dt', {}, 'Corrected grade'), h('dd', {}, gradePill(d.extras.flag.row.grade, true))] : null,
              first.sunnah_ref ? [h('dt', {}, 'Sunnah.com'), h('dd', {}, first.sunnah_ref)] : null,
              first.in_book_ref ? [h('dt', {}, 'In book'), h('dd', {}, first.in_book_ref)] : null),
            d.topics.length ? h('div', { class: 'orig' }, h('div', { class: 'olabel' }, 'iHadis topics'), h('div', { class: 'chips' }, d.topics.map((t) => h('span', { class: 'chip plain' }, t.title)))) : null)),
        ex.el));
  }, 8);
}

// ───────── topics (one list for all libraries) ─────────
export function topicsView(root) {
  const box = h('div', { class: 'panel' });
  const add = rowForm([['name_en', 'English name', 'text'], ['name_ml', 'Malayalam name', 'ml'], ['name_ur', 'Urdu name', 'text']],
    { tbl: 'topics', isNew: true, compact: true, row: {}, submitLabel: 'Add topic', onSaved: (res) => go(`#/t/${res.id}`) });
  root.replaceChildren(
    pageHead({ title: 'Topics', sub: 'One list of topics for every library. Add topics to a hadith on its page; rename them here.' }),
    h('div', { class: 'editor' }, box,
      h('div', { class: 'panel preview' }, h('div', { class: 'ph' }, icon('plus'), h('h2', {}, 'New topic')), h('div', { class: 'pb' }, add.el))));
  load(box, () => api('topics'), (rows) => rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Topic'), h('th', { class: 'hide-sm' }, 'Malayalam'), h('th', { class: 'hide-sm' }, 'Urdu'), h('th', { class: 'num' }, 'Hadith'))),
    h('tbody', {}, rows.map((t) => h('tr', { onclick: () => go(`#/t/${t.id}`) },
      h('td', {}, h('a', { class: 'id', href: `#/t/${t.id}` }, t.name_en)),
      h('td', { class: 'ml hide-sm' }, t.name_ml || h('span', { class: 'zero' }, '—')),
      h('td', { class: 'ur hide-sm', dir: 'rtl' }, t.name_ur || h('span', { class: 'zero' }, '—')),
      h('td', { class: 'num' }, n(t.hadiths))))))) : emptyState('No topics yet. Add the first one with the form, or on any hadith page.'), 8);
}

export function topicView(root, id) {
  const box = h('div');
  root.replaceChildren(box);
  load(box, () => api('topic', { id }), (d) => {
    const form = rowForm([['name_en', 'English name', 'text'], ['name_ml', 'Malayalam name', 'ml'], ['name_ur', 'Urdu name', 'text']],
      { tbl: 'topics', id: d.row.id, ver: d.ver, row: d.row, title: 'Names' });
    setLeaveGuard(form.isDirty);
    return h('div', {},
      pageHead({ crumbs: [h('a', { href: '#/topics' }, 'Topics')], title: d.row.name_en, sub: [d.row.name_ml, d.row.name_ur].filter(Boolean).join(' · ') || null }),
      h('div', { class: 'editor' },
        pagedList({ action: 'topic_hadiths', params: { topic: id }, noun: 'hadith', empty: 'No hadith has this topic yet.',
          item: (r) => h('a', { href: refHref(r.ref) },
            h('span', { class: 'no' }, LIB[r.ref.slice(0, 1)] || ''),
            h('span', { class: 'txt' }, h('span', { class: `snip ${r.ref.startsWith('h:') ? 'ml' : ''}`, style: 'display:block' }, r.snippet || '—'),
              h('span', { class: 'ref', style: 'display:block' }, r.label || r.ref)),
            h('span', { class: 'tags' })) }),
        form.el));
  }, 6);
}
const LIB = { h: 'Ours', s: 'Sunnah', i: 'iHadis' };

