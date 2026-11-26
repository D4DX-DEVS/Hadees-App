// Editor admin page: the library (home shelf, volumes, books, chapters), search, review list, AI search queue.
import { api, busy, emptyState, errorState, fmtTime, h, hadithItem, icon, load, pageHead, pagedList, session, setPending, setQuery, skeleton, toast } from './core.js';
import { rowForm } from './forms.js';
import { go, setLeaveGuard } from './app.js';
import { gradedList } from './sources.js';

const n = (x) => Number(x || 0).toLocaleString();
const noFlag = (r) => hadithItem({ ...r, needs_review: false });   // in a review list every row is flagged: no pill per row
const VOL = (v) => h('a', { href: `#/v/${v}` }, `Volume ${v}`);

// ───────── volume: its books ─────────
export function volumeView(root, id) {
  const box = h('div', { class: 'panel' });
  root.replaceChildren(pageHead({ crumbs: [h('a', { href: '#/' }, 'Library')], title: `Volume ${id}`, sub: 'Books (കിതാബ്) in this volume, in the order of the printed table of contents.' }), box);
  load(box, () => api('books', { volume: id }), (rows) => rows.length ? h('table', { class: 'table' },
    h('thead', {}, h('tr', {}, h('th', { class: 'num', style: 'width:64px' }, 'Book'), h('th', {}, 'Title'), h('th', { class: 'hide-sm' }, 'Arabic title'),
      h('th', { class: 'num hide-sm' }, 'Chapters'), h('th', { class: 'num' }, 'Hadith'))),
    h('tbody', {}, rows.map((r) => h('tr', { onclick: () => go(`#/b/${r.id}`) },
      h('td', { class: 'num' }, h('a', { class: 'id', href: `#/b/${r.id}` }, r.book_no)),
      h('td', { class: 'ml' }, r.title_ml),
      h('td', { class: 'ar hide-sm' }, r.title_ar || h('span', { class: 'zero' }, '—')),
      h('td', { class: 'num hide-sm' }, r.chapters ? n(r.chapters) : h('span', { class: 'zero' }, '0')),
      h('td', { class: 'num' }, r.hadiths ? n(r.hadiths) : h('span', { class: 'zero' }, '0')))))) : emptyState('No books in this volume.'), 6);
}

// ───────── book: titles + chapters ─────────
export function bookView(root, id) {
  const box = h('div');
  root.replaceChildren(box);
  load(box, () => api('book', { id }), (d) => {
    const r = d.row;
    const form = rowForm([
      ['title_ml', 'Title (Malayalam)', 'ml'],
      ['title_ar', 'Title (Arabic)', 'ar'],
      ['start_page', 'First page', 'int'],
    ], { tbl: 'books', id: r.id, ver: d.ver, row: r, title: 'Book details', note: 'A new Malayalam title also refreshes the AI search of every hadith in this book.' });
    setLeaveGuard(form.isDirty);
    const newCh = rowForm([
      ['chapter_no', 'Chapter number', 'int', 'Unique in this book'],
      ['title_ml', 'Title (Malayalam)', 'ml'],
      ['title_ar', 'Title (Arabic)', 'ar'],
      ['start_page', 'First page', 'int'],
    ], { tbl: 'chapters', isNew: true, compact: true, row: { chapter_no: (d.chapters.at(-1)?.chapter_no ?? 0) + 1 }, create: { book_id: r.id },
      submitLabel: 'Add chapter', onSaved: (res) => go(`#/c/${res.id}`) });
    const total = d.chapters.reduce((s, c) => s + c.hadiths, 0) + d.unchaptered;
    return h('div', {},
      pageHead({ crumbs: [h('a', { href: '#/' }, 'Library'), VOL(r.volume_id)], title: `Book ${r.book_no} · ${r.title_ml}`, titleClass: 'ml',
        sub: `${n(d.chapters.length)} chapters · ${n(total)} hadith${r.title_ar ? '' : ' · no Arabic title'}`,
        actions: [h('a', { class: 'btn', href: `#/new?book=${r.id}` }, icon('plus'), 'Hadith without chapter')] }),
      h('div', { class: 'cols' },
        h('div', { class: 'panel' }, h('div', { class: 'ph' }, h('h2', {}, `Chapters`), h('span', { class: 'meta num' }, n(d.chapters.length))),
          d.chapters.length ? h('table', { class: 'table' },
            h('thead', {}, h('tr', {}, h('th', { class: 'num', style: 'width:56px' }, 'No.'), h('th', {}, 'Title'), h('th', { class: 'num' }, 'Hadith'))),
            h('tbody', {}, d.chapters.map((c) => h('tr', { onclick: () => go(`#/c/${c.id}`) },
              h('td', { class: 'num' }, h('a', { class: 'id', href: `#/c/${c.id}` }, c.chapter_no)),
              h('td', { class: 'ml' }, c.title_ml),
              h('td', { class: 'num' }, c.hadiths ? n(c.hadiths) : h('span', { class: 'zero' }, '0')))))) : emptyState('No chapters yet. Add the first one with the form.'),
          d.unchaptered ? h('div', { class: 'pf' }, h('a', { class: 'btn ghost', href: `#/bh/${r.id}` }, `${n(d.unchaptered)} hadith without a chapter`, icon('right'))) : null),
        h('div', {}, form.el,
          h('details', { class: 'panel', style: 'margin-top:16px' }, h('summary', {}, icon('plus'), 'Add a chapter'), h('div', { class: 'pb' }, newCh.el)))));
  }, 6);
}

/** hadith of a book that have no chapter (paged) */
export function bookHadithsView(root, id) {
  root.replaceChildren(
    pageHead({ crumbs: [h('a', { href: '#/' }, 'Library'), h('a', { href: `#/b/${id}` }, 'Book')], title: 'Hadith without a chapter' }),
    gradedList('book_hadiths', { book: id }, hadithItem, 'Every hadith of this book is in a chapter.', { own: true }));
}

// ───────── chapter: details + its hadith (paged) ─────────
export function chapterView(root, id) {
  const box = h('div');
  root.replaceChildren(box);
  load(box, () => api('chapter', { id }), (d) => {
    const r = d.row;
    const form = rowForm([
      ['chapter_no', 'Chapter number', 'int', 'Unique in this book'],
      ['title_ml', 'Title (Malayalam)', 'ml'],
      ['title_ar', 'Title (Arabic)', 'ar'],
      ['start_page', 'First page', 'int'],
    ], { tbl: 'chapters', id: r.id, ver: d.ver, row: r, title: 'Chapter details', note: 'A new Malayalam title also refreshes the AI search of the hadith in this chapter.' });
    setLeaveGuard(form.isDirty);
    return h('div', {},
      pageHead({ crumbs: [h('a', { href: '#/' }, 'Library'), VOL(d.book.volume_id), h('a', { href: `#/b/${d.book.id}`, class: 'ml' }, `Book ${d.book.book_no} · ${d.book.title_ml}`)],
        title: `Chapter ${r.chapter_no} · ${r.title_ml}`, titleClass: 'ml', sub: `${n(d.hadiths)} hadith${d.last_no ? ` · up to No. ${d.last_no}` : ''}`,
        actions: [h('a', { class: 'btn primary', href: `#/new?book=${d.book.id}&chapter=${r.id}` }, icon('plus'), 'Add hadith')] }),
      h('div', { class: 'editor' },
        gradedList('chapter_hadiths', { chapter: r.id }, hadithItem, 'No hadith in this chapter yet. Add the first with “Add hadith”.', { own: true }),
        form.el));
  }, 6);
}

// ───────── search (paged) ─────────
export function searchView(root, params) {
  const qv = params.get('q') || '';
  const input = h('input', { type: 'search', value: qv, placeholder: 'Malayalam or Arabic words, a narrator, or #id', 'aria-label': 'Search words' });
  const form = h('form', { class: 'row', role: 'search', onsubmit: (e) => { e.preventDefault(); setQuery({ q: input.value.trim() }); } },
    h('div', { style: 'flex:1;min-width:220px' }, input), h('button', { class: 'btn primary', type: 'submit' }, icon('search'), 'Search'));
  root.replaceChildren(
    pageHead({ title: qv ? `Search: “${qv}”` : 'Search', sub: 'Malayalam text (spelling variations included), Arabic text (harakat ignored), narrators and labels.' }),
    form, h('div', { style: 'height:16px' }),
    qv.length >= 2
      ? gradedList('search', { q: qv }, hadithItem, 'Nothing found. Try fewer or different words.', { own: true })
      : h('div', { class: 'empty dash' }, 'Type at least 2 letters, or #id for one hadith.'));
  if (!qv) input.focus();
}

// ───────── needs review (paged) ─────────
export function reviewView(root) {
  const sub = h('p', { class: 'sub' }, 'Flagged as uncertain during scanning. Check each against the printed book, then untick “Needs review” in the hadith.');
  root.replaceChildren(
    h('div', { class: 'head' }, h('div', { class: 't' }, h('h1', {}, 'Needs review'), sub)),
    gradedList('review', {}, noFlag, 'Nothing left to review.', { own: true, noun: 'hadith to review',
      onData: (res) => sub.replaceChildren(h('b', {}, `${n(res.total)} hadith`), ' flagged as uncertain during scanning. Check each against the printed book, then untick “Needs review”.') }));
}

// ───────── AI search queue (paged) ─────────
export function pendingView(root) {
  const runBtn = h('button', { class: 'btn primary' }, icon('sparkles'), 'Update AI search now');
  const msg = h('span', { class: 'small muted' });
  runBtn.addEventListener('click', () => busy(runBtn, async () => {
    let left = Math.max(1, session.pending);
    for (let round = 0; round < 20 && left > 0; round++) {
      const r = await api('embed_run', {}, {});
      if (r.error) throw new Error(r.error);
      left = r.left;
      setPending(left);
      msg.textContent = `${n(left)} still waiting…`;
    }
    toast(left ? `${n(left)} still waiting. Run again to continue.` : 'AI search is up to date.');
    pendingView(root);
  }));
  root.replaceChildren(
    pageHead({ title: 'AI search', sub: 'After an edit the AI needs a new copy of the hadith’s meaning to find it. This happens on save; when the AI service is busy or over its free daily limit, the hadith wait here.',
      actions: [msg, runBtn] }),
    pagedList({ action: 'pending', params: {}, item: hadithItem, noun: 'waiting', empty: 'Nothing waiting. The AI search is up to date.',
      onData: (res) => { setPending(res.total); runBtn.disabled = !res.total; } }));
}
