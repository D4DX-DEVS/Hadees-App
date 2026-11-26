// Editor admin page: the dashboard (#/). The numbers that matter, the four volumes, the libraries, what to do next.
import { api, busy, emptyState, errorState, fmtTime, h, hadithItem, icon, setPending, skeleton } from './core.js';
import { go } from './app.js';

const n = (x) => Number(x || 0).toLocaleString();
const noFlag = (r) => hadithItem({ ...r, needs_review: false });   // in a review list every row is flagged: no pill per row

export function homeView(root) {
  const v = h('input', { type: 'number', min: 1, inputmode: 'numeric', placeholder: 'Vol', 'aria-label': 'Volume' });
  const b = h('input', { type: 'number', min: 1, inputmode: 'numeric', placeholder: 'Book', 'aria-label': 'Book number' });
  const no = h('input', { type: 'number', min: 1, inputmode: 'numeric', placeholder: 'No.', 'aria-label': 'Hadith number' });
  const goBtn = h('button', { class: 'btn primary', type: 'submit' }, 'Open');
  const gotoForm = h('form', { class: 'joined goto', novalidate: true, 'aria-label': 'Open a hadith by its numbers', onsubmit: (e) => {
    e.preventDefault();
    busy(goBtn, async () => {
      if (!v.value || !b.value || !no.value) throw new Error('Fill in volume, book and hadith number.');
      const r = await api('goto', { v: v.value, b: b.value, n: no.value });
      if (!r.id) throw new Error(`There is no hadith ${no.value} in volume ${v.value}, book ${b.value}.`);
      go(`#/h/${r.id}`);
    });
  } }, v, b, no, goBtn);

  const sub = h('p', { class: 'sub' }, h('span', { class: 'sk', style: 'display:inline-block;width:220px' }));
  const stats = h('div', { class: 'stats' }, [0, 1, 2, 3].map(() => h('div', { class: 'stat' },
    h('span', { class: 'sk', style: 'width:60%' }), h('span', { class: 'sk', style: 'width:40%;height:22px;margin-top:12px' }))));
  const volumesBox = h('div', { class: 'vol-grid' }, [1, 2, 3, 4].map(() => h('div', { class: 'vcard' },
    h('span', { class: 'sk', style: 'width:50%' }), h('span', { class: 'sk', style: 'width:80%;margin-top:14px' }))));
  const libBox = h('div');
  const reviewBox = h('div');
  const editsBox = h('div');
  root.replaceChildren(
    h('div', { class: 'head' }, h('div', { class: 't' }, h('h1', {}, 'Dashboard'), sub),
      h('div', { class: 'actions' }, h('div', { class: 'goto-wrap' }, h('span', { class: 'small muted' }, 'Open a hadith by number'), gotoForm))),
    stats,
    h('div', { class: 'section-head' }, h('h2', {}, 'Volumes'), h('span', { class: 'meta' }, 'Open a volume for its books and chapters')),
    volumesBox,
    libBox,
    h('div', { class: 'cols', style: 'margin-top:24px' }, reviewBox, editsBox));

  const run = () => api('overview').then((d) => {
    setPending(d.pending);
    const total = d.books.reduce((s, bk) => s + bk.hadiths, 0);
    sub.replaceChildren(d.last_edit ? `Last saved ${fmtTime(d.last_edit.at)}` : 'No edits saved yet');
    const stat = (ic, label, value, href, tone = '') => h(href ? 'a' : 'div', { class: `stat ${tone}`, href },
      h('span', { class: 'slabel' }, icon(ic), h('span', {}, label)), h('span', { class: 'svalue num' }, n(value)));
    stats.replaceChildren(
      stat('book', 'Hadith', total, null),
      stat('flag', 'Need review', d.review, '#/review', d.review ? 'warn' : 'good'),
      stat('history', 'Edits today', d.edits_today, '#/history'),
      stat('sparkles', 'AI search waiting', d.pending, '#/pending', d.pending ? 'warn' : 'good'));
    volumesBox.replaceChildren(...d.volumes.map((vol) => {
      const books = d.books.filter((bk) => bk.volume_id === vol.id);
      const hs = books.reduce((s, bk) => s + bk.hadiths, 0);
      const rv = books.reduce((s, bk) => s + bk.review, 0);
      const pct = hs ? Math.floor(((hs - rv) / hs) * 1000) / 10 : 100;
      return h('a', { class: 'vcard', href: `#/v/${vol.id}` },
        h('div', { class: 'vtop' }, h('b', {}, `Volume ${vol.id}`),
          rv ? h('span', { class: 'pill warn' }, `${n(rv)} to review`) : h('span', { class: 'pill ok' }, 'All checked')),
        vol.title_ml ? h('div', { class: 'vtitle ml' }, vol.title_ml) : null,
        h('div', { class: 'vnums' }, h('span', {}, h('b', { class: 'num' }, n(books.length)), ' books'), h('span', {}, h('b', { class: 'num' }, n(hs)), ' hadith')),
        h('div', { class: 'bar', role: 'img', 'aria-label': `${pct}% checked` }, h('i', { style: `width:${pct}%` })),
        h('div', { class: 'small muted' }, `${pct}% checked`));
    }));
  }).catch((e) => stats.replaceChildren(errorState(e, run)));
  run();

  api('extras_stats').then((x) => {
    const tile = (ic, label, value, href) => h('a', { class: 'ltile', href }, icon(ic),
      h('span', {}, h('b', { class: 'num' }, n(value)), h('span', { class: 'small muted' }, label)));
    libBox.replaceChildren(
      h('div', { class: 'section-head' }, h('h2', {}, 'Libraries'), h('span', { class: 'meta' }, 'Sunnah.com and iHadis stay as imported; your translations and topics are kept separately')),
      h('div', { class: 'ltiles' },
        tile('globe', 'Sunnah.com hadith', x.sunnah, '#/src?tab=sunnah'),
        tile('globe', 'iHadis hadith', x.ihadis, '#/src?tab=ihadis'),
        tile('languages', 'translations added', x.own_texts + x.source_texts, '#/history?tbl=hadith_texts'),
        tile('tag', `topics · on ${n(x.tagged)} hadith`, x.topics, '#/topics')));
  }).catch((e) => libBox.replaceChildren(h('div', { class: 'notice', style: 'margin-top:24px' }, `Libraries: ${e.message}`)));

  miniList(reviewBox, 'Needs review', '#/review', 'review', noFlag, 'Nothing left to review.');
  miniList(editsBox, 'Recent edits', '#/history', 'history', (e) => h('a', { href: `#/edit/${e.id}` },
    h('span', { class: 'no num' }, `#${e.id}`),
    h('span', { class: 'txt' }, h('span', { style: 'display:block' }, e.tbl === 'hadiths' ? `Hadith ${e.hadith_no ?? ''} · Volume ${e.volume_id ?? '?'}, Book ${e.book_no ?? '?'}` : `${e.tbl.replace('_', ' ')} ${e.title || e.name || e.row_id}`),
      h('span', { class: 'ref', style: 'display:block' }, fmtTime(e.at) + (e.note ? ` · ${e.note}` : ''))),
    h('span', { class: 'tags' }, h('span', { class: `pill ${e.action === 'delete' ? 'bad' : e.action === 'insert' ? 'ok' : ''}` }, { insert: 'Added', update: 'Changed', delete: 'Deleted', undo: 'Undo' }[e.action]))),
  'No edits yet. Changes made here appear in this list.');
}

/** a panel with the first 5 rows of a paged list and a "View all" with the total */
function miniList(box, title, href, action, item, empty) {
  const all = h('a', { class: 'btn ghost', href }, 'View all');
  box.replaceChildren(h('div', { class: 'panel' }, h('div', { class: 'ph' }, h('h2', {}, title), h('span', { class: 'spacer' }), all), skeleton(5)));
  api(action, { pageSize: 10 }).then((res) => {
    all.textContent = res.total ? `View all ${n(res.total)}` : 'View all';
    box.firstChild.replaceChildren(box.firstChild.firstChild,
      res.total ? h('div', { class: 'rows' }, res.data.slice(0, 5).map(item)) : emptyState(empty));
  }).catch((e) => box.firstChild.replaceChildren(box.firstChild.firstChild, h('div', { class: 'pb' }, errorState(e, () => miniList(box, title, href, action, item, empty)))));
}
