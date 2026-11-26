// Editor admin page: history (with Undo), articles (blocks), narrators (biography + spellings).
import { api, busy, confirmBox, emptyState, fmtTime, h, icon, load, pageHead, pagedList, setQuery, toast, wordDiff } from './core.js';
import { rowForm } from './forms.js';
import { go, setLeaveGuard } from './app.js';

const TABLE_NAMES = { hadiths: 'Hadith', books: 'Book', chapters: 'Chapter', articles: 'Article', article_blocks: 'Article block',
  narrators: 'Narrator', narrator_spellings: 'Narrator spelling' };
const ACTIONS = { insert: 'added', update: 'changed', delete: 'deleted', undo: 'undo' };
const ACTION_PILL = { insert: ['ok', 'Added'], update: ['', 'Changed'], delete: ['bad', 'Deleted'], undo: ['', 'Undo'] };
const FIELD_LABELS = { arabic_text: 'Arabic text', malayalam_text: 'Malayalam translation', narrator_ar: 'Narrator (Arabic)',
  narrator_ml: 'Narrator (Malayalam)', explanation_ml: 'Explanation', source_codes_ar: 'Source codes (Arabic)', source_codes_ml: 'Source codes (Malayalam)',
  grading_note_ar: 'Grading note (Arabic)', grading_note_ml: 'Grading note (Malayalam)', hadith_no: 'Hadith number', hadith_label: 'Label',
  chapter_id: 'Chapter (id)', page_start: 'First page', page_end: 'Last page', needs_review: 'Needs review', _variants: 'Variants', _relations: 'Same-hadith links',
  title_ml: 'Title (Malayalam)', title_ar: 'Title (Arabic)', start_page: 'First page', end_page: 'Last page', chapter_no: 'Chapter number',
  name_ml: 'Name', bio_ml: 'Biography', text_ml: 'Text', kind: 'Kind', seq: 'Position', rows: 'Table rows', page: 'Page', narrator_id: 'Narrator (id)' };
const LINK = { hadiths: 'h', books: 'b', chapters: 'c', articles: 'a', narrators: 'n' };

function editTitle(e) {
  const what = TABLE_NAMES[e.tbl] || e.tbl;
  if (e.tbl === 'hadiths') return `${what} · Vol ${e.volume_id ?? '?'} · Book ${e.book_no ?? '?'} · No. ${e.hadith_no ?? '?'}`;
  return `${what} ${e.title || e.name || '#' + e.row_id}`;
}

// ───────── history (paged) ─────────
export function historyView(root, params) {
  const tbl = params.get('tbl') || '';
  const row = params.get('row') || '';
  const filter = h('select', { 'aria-label': 'Show changes of', onchange: (e) => setQuery({ tbl: e.target.value, row: null }) },
    h('option', { value: '' }, 'All changes'),
    Object.entries(TABLE_NAMES).map(([k, v]) => h('option', { value: k, selected: k === tbl ? true : null }, `${v} changes`)));
  root.replaceChildren(
    pageHead({ title: 'History', sub: 'Every change made in the editor, newest first. Undo writes the old version back and is recorded too; only the newest change of a row can be undone.',
      actions: [row ? h('a', { class: 'btn ghost', href: '#/history' }, `One row (${row}) · show all`) : null, h('div', { style: 'width:200px' }, filter)].filter(Boolean) }),
    pagedList({ action: 'history', params: { ...(tbl ? { tbl } : {}), ...(row ? { row } : {}) }, noun: 'changes', empty: 'No changes yet. Saves made in the editor appear here.',
      item: (e) => h('a', { href: `#/edit/${e.id}` },
        h('span', { class: 'no num' }, `#${e.id}`),
        h('span', { class: 'txt' }, h('span', { style: 'display:block' }, editTitle(e)),
          h('span', { class: 'ref', style: 'display:block' }, `${fmtTime(e.at)}${e.note ? ' · ' + e.note : ''}`)),
        h('span', { class: 'tags' }, h('span', { class: `pill ${ACTION_PILL[e.action][0]}` }, ACTION_PILL[e.action][1]),
          e.undone_by ? h('span', { class: 'pill warn' }, `Undone by #${e.undone_by}`) : null)) }));
}

/** one edit: what changed, side by side, with Undo */
export function editView(root, id) {
  const box = h('div');
  root.replaceChildren(box);
  load(box, () => api('edit', { id }), (e) => {
    const o = e.old_row || {}, n = e.new_row || {};
    const keys = [...new Set([...Object.keys(o), ...Object.keys(n)])]
      .filter((k) => !['updated_at', 'created_at', 'arabic_plain', 'malayalam_search', 'narrator_search'].includes(k))
      .filter((k) => e.action !== 'update' && e.action !== 'undo' ? true : JSON.stringify(o[k]) !== JSON.stringify(n[k]));
    const txt = (v) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v, null, 1) : String(v));
    const undoBtn = h('button', { class: 'btn' }, icon('undo'), 'Undo this change');
    undoBtn.addEventListener('click', async () => {
      const ok = await confirmBox({ title: 'Undo this change?', ok: 'Undo',
        text: e.action === 'insert' ? 'The added row will be removed again.' : e.action === 'delete' ? 'The deleted row will be put back.' : 'The old version of the changed fields will be written back.' });
      if (!ok) return;
      busy(undoBtn, async () => {
        const r = await api('undo', {}, { edit: e.id });
        toast('Undone.');
        go(LINK[r.tbl] && e.action !== 'insert' ? `#/${LINK[r.tbl]}/${r.id}` : `#/edit/${r.undo}`);
      });
    });
    const link = LINK[e.tbl] && e.action !== 'delete' ? h('a', { class: 'btn', href: `#/${LINK[e.tbl]}/${e.row_id}` }, 'Open', icon('right')) : null;
    return h('div', {},
      pageHead({ crumbs: [h('a', { href: '#/history' }, 'History')], title: `${TABLE_NAMES[e.tbl] || e.tbl} ${ACTIONS[e.action]}`,
        sub: `Change #${e.id} · ${fmtTime(e.at)} · row ${e.row_id}${e.note ? ' · ' + e.note : ''}`,
        actions: [link, e.action !== 'undo' && !e.undone_by ? undoBtn : null].filter(Boolean) }),
      e.undone_by ? h('div', { class: 'notice' }, 'This change was undone by ', h('a', { href: `#/edit/${e.undone_by}` }, `#${e.undone_by}`), '.') : null,
      e.undoes ? h('div', { class: 'notice' }, 'This is the undo of ', h('a', { href: `#/edit/${e.undoes}` }, `#${e.undoes}`), '.') : null,
      keys.length ? h('div', { class: 'panel diff' },
        h('div', { class: 'h' }, 'Field'), h('div', { class: 'h' }, 'Before'), h('div', { class: 'h' }, 'After'),
        keys.flatMap((k) => {
          const a = txt(o[k]), b = txt(n[k]);
          const cls = /arabic|_ar$|codes_ar/.test(k) ? 'ar' : /malayalam|_ml$|title_ml|bio_ml|text_ml/.test(k) ? 'ml' : '';
          return [h('div', { class: 'k' }, FIELD_LABELS[k] || k),
            h('div', { class: cls, dir: cls === 'ar' ? 'rtl' : null }, e.action === 'update' || e.action === 'undo' ? wordDiff(a, b).filter((x) => x.tagName !== 'INS') : a),
            h('div', { class: cls, dir: cls === 'ar' ? 'rtl' : null }, e.action === 'update' || e.action === 'undo' ? wordDiff(a, b).filter((x) => x.tagName !== 'DEL') : b)];
        })) : emptyState('No field changed.'));
  }, 4);
}

// ───────── articles ─────────
export function articlesView(root) {
  const box = h('div', { class: 'panel' });
  root.replaceChildren(pageHead({ title: 'Articles', sub: 'The prose sections of the volumes: introduction, biography, hadith sciences, narrators.' }), box);
  load(box, () => api('articles'), (rows) => rows.length ? h('table', { class: 'table' },
    h('thead', {}, h('tr', {}, h('th', { class: 'num', style: 'width:72px' }, 'Volume'), h('th', { class: 'num', style: 'width:64px' }, 'No.'), h('th', {}, 'Title'),
      h('th', { class: 'num hide-sm' }, 'Pages'), h('th', { class: 'num' }, 'Blocks'))),
    h('tbody', {}, rows.map((r) => h('tr', { onclick: () => go(`#/a/${r.id}`) },
      h('td', { class: 'num' }, r.volume_id), h('td', { class: 'num' }, r.section_no),
      h('td', { class: 'ml' }, h('a', { class: 'id', href: `#/a/${r.id}` }, r.title_ml)),
      h('td', { class: 'num hide-sm' }, r.start_page ? `${r.start_page}–${r.end_page ?? r.start_page}` : '—'),
      h('td', { class: 'num' }, r.blocks))))) : emptyState('No articles.'), 8);
}

const BLOCK_FIELDS = (kind) => [
  ['kind', 'Kind', 'select:heading,subheading,paragraph,arabic,list_item,table,footnote'],
  kind === 'table' ? ['rows', 'Table rows (JSON list of rows)', 'json', 'e.g. [["cell", "cell"], ["cell", "cell"]]'] : ['text_ml', 'Text', kind === 'arabic' ? 'ar-area' : 'ml-area'],
  ['page', 'Page', 'int'],
];

export function articleView(root, id) {
  const box = h('div');
  root.replaceChildren(box);
  const reload = () => articleView(root, id);
  load(box, () => api('article', { id }), (d) => {
    const r = d.row;
    const meta = rowForm([['title_ml', 'Title', 'ml'], ['start_page', 'First page', 'int'], ['end_page', 'Last page', 'int']],
      { tbl: 'articles', id: r.id, ver: d.ver, row: r, title: 'Article details' });
    const blockForms = [meta];
    const blocks = d.blocks.map(({ row: b, ver }, i) => {
      const del = h('button', { class: 'btn danger', type: 'button' }, icon('trash'), 'Delete');
      del.addEventListener('click', async () => {
        if (!(await confirmBox({ title: 'Delete this block?', danger: true, ok: 'Delete', text: 'It stays in History, where Undo brings it back.' }))) return;
        busy(del, async () => { await api('delete', {}, { tbl: 'article_blocks', id: b.id, ver }); toast('Block deleted.'); reload(); });
      });
      const move = (dir) => {
        const btn = h('button', { class: 'btn ghost icon', type: 'button', title: dir < 0 ? 'Move up' : 'Move down', 'aria-label': dir < 0 ? 'Move up' : 'Move down', disabled: (dir < 0 && i === 0) || (dir > 0 && i === d.blocks.length - 1) ? true : null }, icon(dir < 0 ? 'up' : 'down'));
        btn.addEventListener('click', () => busy(btn, async () => { await api('block_move', {}, { id: b.id, dir }); reload(); }));
        return btn;
      };
      const f = rowForm(BLOCK_FIELDS(b.kind), { tbl: 'article_blocks', id: b.id, ver, row: b, compact: true, extra: [h('span', { class: 'spacer' }), move(-1), move(1), del] });
      blockForms.push(f);
      return h('div', { class: 'form-section' }, h('h2', {}, `Block ${i + 1}`, h('span', { class: 'pill', style: 'margin-left:8px' }, b.kind.replace('_', ' '))), f.el);
    });
    setLeaveGuard(() => blockForms.some((f) => f.isDirty()));
    const lastSeq = d.blocks.at(-1)?.row.seq ?? 0;
    const add = rowForm([['kind', 'Kind', 'select:paragraph,heading,subheading,arabic,list_item,footnote'], ['text_ml', 'Text', 'ml-area'], ['page', 'Page', 'int']],
      { tbl: 'article_blocks', isNew: true, compact: true, row: { kind: 'paragraph' }, create: { article_id: r.id, seq: lastSeq + 1 }, submitLabel: 'Add block at the end', onSaved: reload });
    return h('div', {},
      pageHead({ crumbs: [h('a', { href: '#/articles' }, 'Articles')], title: r.title_ml, titleClass: 'ml',
        sub: `Volume ${r.volume_id} · section ${r.section_no}${r.start_page ? ` · pages ${r.start_page}–${r.end_page ?? r.start_page}` : ''} · ${d.blocks.length} blocks` }),
      h('div', { class: 'editor' },
        h('div', {},
          h('div', { class: 'panel' }, h('div', { class: 'ph' }, h('h2', {}, 'Blocks'), h('span', { class: 'meta' }, 'In reading order')), ...blocks),
          h('details', { class: 'panel', style: 'margin-top:16px' }, h('summary', {}, icon('plus'), 'Add a block'), h('div', { class: 'pb' }, add.el))),
        h('div', { class: 'preview' }, meta.el)));
  }, 6);
}

// ───────── narrators (paged) ─────────
export function narratorsView(root) {
  root.replaceChildren(
    pageHead({ title: 'Narrators', sub: 'Biographies from the book, and the spellings that link hadith to each narrator.' }),
    pagedList({ action: 'narrators', params: {}, noun: 'narrators', empty: 'No narrators.',
      item: (r) => h('a', { href: `#/n/${r.id}` },
        h('span', { class: 'no num' }, r.id),
        h('span', { class: 'txt' }, h('span', { class: 'snip', style: 'display:block' }, r.name_ml),
          h('span', { class: 'ref', style: 'display:block' }, r.page ? `Page ${r.page}` : '—')),
        h('span', { class: 'tags' }, h('span', { class: 'pill' }, `${r.spellings} spelling${r.spellings === 1 ? '' : 's'}`))) }));
}

export function narratorView(root, id) {
  const box = h('div');
  root.replaceChildren(box);
  const reload = () => narratorView(root, id);
  load(box, () => api('narrator', { id }), (d) => {
    const r = d.row;
    const form = rowForm([['name_ml', 'Name (Malayalam)', 'ml'], ['bio_ml', 'Biography', 'ml-area'], ['page', 'Page', 'int']],
      { tbl: 'narrators', id: r.id, ver: d.ver, row: r, title: 'Biography' });
    setLeaveGuard(form.isDirty);
    const spelling = h('input', { id: 'sp-new', type: 'text', class: 'ml', placeholder: 'Exactly as written in the hadith', 'aria-label': 'New spelling' });
    const addBtn = h('button', { class: 'btn', type: 'submit' }, icon('plus'), 'Link');
    const addForm = h('form', { class: 'row', style: 'flex:1', novalidate: true, onsubmit: (e) => {
      e.preventDefault();
      busy(addBtn, async () => {
        if (!spelling.value.trim()) throw new Error('Type a spelling first.');
        await api('create', {}, { tbl: 'narrator_spellings', fields: { spelling: spelling.value.trim(), narrator_id: r.id } });
        toast('Spelling linked.');
        reload();
      });
    } }, h('div', { style: 'flex:1' }, spelling), addBtn);
    const linked = d.spellings.reduce((s, x) => s + x.hadiths, 0);
    return h('div', {},
      pageHead({ crumbs: [h('a', { href: '#/narrators' }, 'Narrators')], title: r.name_ml, titleClass: 'ml',
        sub: `Narrator ${r.id}${r.page ? ` · page ${r.page}` : ''} · ${linked.toLocaleString()} hadith linked through ${d.spellings.length} spelling${d.spellings.length === 1 ? '' : 's'}` }),
      h('div', { class: 'editor' },
        form.el,
        h('div', { class: 'panel preview' },
          h('div', { class: 'ph' }, h('h2', {}, 'Spellings'), h('span', { class: 'spacer' }), h('span', { class: 'meta num' }, d.spellings.length)),
          h('p', { class: 'small muted', style: 'margin:12px 16px 4px' }, 'A hadith shows this narrator when its “Narrator (Malayalam)” is exactly one of these.'),
          d.spellings.length ? h('div', { class: 'rows' }, d.spellings.map((s) => {
            const rm = h('button', { class: 'btn ghost', type: 'button' }, 'Remove');
            rm.addEventListener('click', async () => {
              if (!(await confirmBox({ title: 'Remove this spelling?', danger: true, ok: 'Remove', text: `“${s.spelling}” will no longer link ${s.hadiths} hadith to this narrator.` }))) return;
              busy(rm, async () => { await api('delete', {}, { tbl: 'narrator_spellings', id: s.spelling, ver: '' }); toast('Removed.'); reload(); });
            });
            return h('div', { class: 'item', style: 'grid-template-columns:minmax(0,1fr) auto auto' }, h('span', { class: 'snip' }, s.spelling), h('span', { class: 'small muted num' }, `${s.hadiths} hadith`), rm);
          })) : h('div', { class: 'empty' }, 'No spellings linked.'),
          h('div', { class: 'pf' }, addForm))));
  }, 4);
}
