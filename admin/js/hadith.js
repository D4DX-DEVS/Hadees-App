// Editor admin page: hadith editor (#/h/<id>) and new hadith (#/new?book=<id>&chapter=<id>).
import { api, busy, confirmBox, errorState, h, hadithRef, icon, pageHead, skeleton, toast } from './core.js';
import { go, setLeaveGuard } from './app.js';

/** form fields in display order: [column, label, kind, hint] */
const FIELDS = [
  ['arabic_text', 'Arabic text', 'ar-area', 'As printed, with harakat'],
  ['malayalam_text', 'Malayalam translation', 'ml-area', ''],
  ['narrator_ar', 'Narrator (Arabic)', 'ar-line', ''],
  ['narrator_ml', 'Narrator (Malayalam)', 'ml-line', 'Spelled exactly like other hadith of this narrator, so the narrator page finds it'],
  ['explanation_ml', 'Explanation (Malayalam)', 'ml-area', 'Optional'],
  ['source_codes_ar', 'Source codes (Arabic)', 'codes-ar', 'Separated by spaces, e.g. خ م ن'],
  ['source_codes_ml', 'Source codes (Malayalam)', 'codes-ml', 'Separated by spaces, e.g. ബു മു ന'],
  ['grading_note_ar', 'Grading note (Arabic)', 'ar-line', 'Optional'],
  ['grading_note_ml', 'Grading note (Malayalam)', 'ml-line', 'Optional'],
];

const toForm = (col, v) => (col.startsWith('source_codes') ? (v || []).join(' ') : v ?? '');

export async function hadithView(root, id) {
  root.replaceChildren(skeleton(8));
  let data;
  try {
    data = await api('hadith', { id });
  } catch (e) {
    root.replaceChildren(errorState(e, () => hadithView(root, id)));
    return;
  }
  renderForm(root, data, false);
}

export async function newHadithView(root, params) {
  root.replaceChildren(skeleton(8));
  let book;
  try {
    book = await api('book', { id: params.get('book') });
  } catch (e) {
    root.replaceChildren(errorState(e, () => newHadithView(root, params)));
    return;
  }
  const chapterId = Number(params.get('chapter')) || null;
  const chapterHadiths = chapterId ? await api('chapter', { id: chapterId }).then((c) => c.hadiths).catch(() => []) : [];
  const nextNo = chapterHadiths.length ? Math.max(...chapterHadiths.map((x) => x.hadith_no)) + 1 : '';
  const row = { id: null, book_id: book.row.id, chapter_id: chapterId, hadith_no: nextNo, needs_review: false, _variants: [] };
  renderForm(root, { row, ver: '', book: { ...book.row }, chapters: book.chapters, pending: false, edits: 0 }, true);
}

function renderForm(root, data, isNew) {
  const { row, book, chapters } = data;
  const ctl = {};          // column -> input element
  const variants = (row._variants || []).map((v) => ({ ...v }));
  let ver = data.ver;
  let saved = { ...row };

  // ── inputs ──
  const input = (col, kind) => {
    const v = toForm(col, row[col]);
    const cls = kind.startsWith('ar') || kind === 'codes-ar' ? 'ar' : kind.startsWith('ml') || kind === 'codes-ml' ? 'ml' : '';
    const el = kind.endsWith('area')
      ? h('textarea', { id: `f-${col}`, class: cls, rows: kind === 'ar-area' ? 6 : 8, dir: cls === 'ar' ? 'rtl' : 'auto', value: v })
      : h('input', { id: `f-${col}`, type: 'text', class: cls, dir: cls === 'ar' ? 'rtl' : 'auto', value: v });
    el.addEventListener('input', refresh);
    ctl[col] = el;
    return el;
  };
  const field = (col, label, el, hint) =>
    h('div', { class: 'field' }, h('label', { for: el.id }, label), el, hint ? h('span', { class: 'hint' }, hint) : null);

  ctl.hadith_no = h('input', { id: 'f-hadith_no', type: 'number', min: 1, value: row.hadith_no ?? '', oninput: refresh });
  ctl.hadith_label = h('input', { id: 'f-hadith_label', type: 'text', value: row.hadith_label ?? '', oninput: refresh });
  ctl.page_start = h('input', { id: 'f-page_start', type: 'number', min: 0, value: row.page_start ?? '', oninput: refresh });
  ctl.page_end = h('input', { id: 'f-page_end', type: 'number', min: 0, value: row.page_end ?? '', oninput: refresh });
  ctl.chapter_id = h('select', { id: 'f-chapter_id', onchange: refresh },
    h('option', { value: '' }, '— no chapter —'),
    chapters.map((c) => h('option', { value: c.id, selected: c.id === row.chapter_id ? true : null }, `${c.chapter_no}. ${c.title_ml}`)));
  ctl.needs_review = h('input', { id: 'f-needs_review', type: 'checkbox', checked: row.needs_review, onchange: refresh });
  const note = h('input', { id: 'f-note', type: 'text', placeholder: 'e.g. corrected from the printed book, page 214', maxlength: 500 });

  // ── variants ──
  const variantBox = h('div');
  const drawVariants = () => {
    variantBox.replaceChildren(...variants.map((v, i) => h('div', { class: 'variant' },
      h('div', { class: 'row' }, h('b', {}, `Variant ${i + 1}`), h('span', { class: 'spacer' }),
        h('button', { class: 'btn ghost small', type: 'button', onclick: () => { variants.splice(i, 1); drawVariants(); refresh(); } }, 'Remove')),
      h('div', { class: 'field' }, h('label', { for: `va${i}` }, 'Arabic'),
        h('textarea', { id: `va${i}`, class: 'ar', dir: 'rtl', rows: 3, value: v.arabic_text ?? '', oninput: (e) => { v.arabic_text = e.target.value; refresh(); } })),
      h('div', { class: 'field' }, h('label', { for: `vm${i}` }, 'Malayalam'),
        h('textarea', { id: `vm${i}`, class: 'ml', rows: 3, value: v.malayalam_text ?? '', oninput: (e) => { v.malayalam_text = e.target.value; refresh(); } })))));
  };
  drawVariants();

  // ── preview (as the app shows a hadith) ──
  const pv = { ar: h('div', { class: 'ar', dir: 'rtl' }), ml: h('div', { class: 'ml' }), meta: h('div', { class: 'meta' }) };
  const preview = h('aside', { class: 'panel preview', 'aria-label': 'Preview' },
    h('div', { class: 'ph' }, h('h2', {}, 'As readers see it'), h('span', { class: 'spacer' }), h('span', { class: 'meta' }, 'Updates as you type')),
    h('div', { class: 'reader' }, pv.ar, pv.ml, pv.meta));

  // ── what changed ──
  const current = () => {
    const f = {};
    for (const [col] of FIELDS) f[col] = ctl[col].value;
    f.hadith_no = ctl.hadith_no.value;
    f.hadith_label = ctl.hadith_label.value;
    f.page_start = ctl.page_start.value;
    f.page_end = ctl.page_end.value;
    f.chapter_id = ctl.chapter_id.value === '' ? null : Number(ctl.chapter_id.value);
    f.needs_review = ctl.needs_review.checked;
    return f;
  };
  const cleanVariants = () => variants
    .map((v) => ({ arabic_text: (v.arabic_text ?? '').trim() ? v.arabic_text : null, malayalam_text: (v.malayalam_text ?? '').trim() ? v.malayalam_text : null }))
    .filter((v) => v.arabic_text !== null || v.malayalam_text !== null);
  const changedFields = () => {
    const f = current();
    const out = {};
    for (const [k, v] of Object.entries(f)) {
      const before = k === 'needs_review' ? !!saved[k] : k === 'chapter_id' ? saved[k] ?? null : String(toForm(k, saved[k]));
      const now = k === 'needs_review' || k === 'chapter_id' ? v : String(v);
      if (before !== now) out[k] = v;
    }
    return out;
  };
  const variantsChanged = () => JSON.stringify(cleanVariants()) !== JSON.stringify(saved._variants || []);
  const isDirty = () => isNew || Object.keys(changedFields()).length > 0 || variantsChanged();

  const status = h('span', { class: 'small muted' });
  let edits = data.edits;
  const historyLink = h('a', { class: 'btn ghost', href: `#/history?tbl=hadiths&row=${row.id}` }, icon('history'), h('span', {}, `History (${edits})`));
  const saveBtn = h('button', { class: 'btn primary', type: 'submit' }, isNew ? 'Add hadith' : 'Save changes');

  function refresh() {
    const f = current();
    pv.ar.textContent = f.arabic_text;
    pv.ml.textContent = f.malayalam_text;
    const codes = f.source_codes_ml.trim();
    pv.meta.replaceChildren(...[
      h('div', {}, `${f.hadith_label || 'Hadith ' + (f.hadith_no || '?')}${f.narrator_ml ? ' · ' + f.narrator_ml : ''}`),
      codes ? h('div', {}, `(${codes})`) : null,
      f.grading_note_ml ? h('div', {}, f.grading_note_ml) : null].filter(Boolean));
    const changed = isNew ? [] : Object.keys(changedFields());
    for (const [col, el] of Object.entries(ctl)) el.classList.toggle('dirty', changed.includes(col));
    if (!isNew) {
      const n = changed.length + (variantsChanged() ? 1 : 0);
      status.textContent = n ? `${n} unsaved change${n > 1 ? 's' : ''}` : 'No unsaved changes';
      saveBtn.disabled = n === 0;
    }
  }

  async function save(e) {
    e.preventDefault();
    await busy(saveBtn, async () => {
      if (isNew) {
        const res = await api('create', {}, { tbl: 'hadiths', fields: { ...current(), book_id: book.id }, variants: cleanVariants(), note: note.value });
        setLeaveGuard(null);
        toast('Hadith added.' + embedMsg(res.embed));
        go(`#/h/${res.id}`);
        return;
      }
      const fields = changedFields();
      const body = { tbl: 'hadiths', id: row.id, ver, fields, note: note.value };
      if (variantsChanged()) body.variants = cleanVariants();
      const res = await api('save', {}, body);
      ver = res.ver;
      saved = res.row;
      note.value = '';
      if (res.changed.length) historyLink.lastChild.textContent = `History (${++edits})`;
      toast(res.changed.length ? 'Saved.' + embedMsg(res.embed) : 'Nothing to save.');
      refresh();
    });
  }

  async function remove(btn) {
    const ok = await confirmBox({ title: 'Delete this hadith?', danger: true, ok: 'Delete',
      text: `${hadithRef({ ...book, ...saved })} will disappear from the website and the app. It stays in History, where Undo brings it back.` });
    if (!ok) return;
    await busy(btn, async () => {
      await api('delete', {}, { tbl: 'hadiths', id: row.id, ver, note: note.value });
      setLeaveGuard(null);
      toast('Deleted. History → Undo brings it back.');
      go(row.chapter_id ? `#/c/${row.chapter_id}` : `#/b/${book.id}`);
    });
  }

  setLeaveGuard(() => isDirty() && !saveBtn.disabled);

  const chapterNo = chapters.find((c) => c.id === row.chapter_id)?.chapter_no;
  const head = pageHead({
    crumbs: [h('a', { href: '#/' }, 'Library'), h('a', { href: `#/v/${book.volume_id}` }, `Volume ${book.volume_id}`),
      h('a', { href: `#/b/${book.id}`, class: 'ml' }, `Book ${book.book_no} · ${book.title_ml}`),
      row.chapter_id ? h('a', { href: `#/c/${row.chapter_id}` }, `Chapter ${chapterNo ?? ''}`) : null].filter(Boolean),
    title: isNew ? 'New hadith' : (row.hadith_label || `Hadith ${row.hadith_no}`),
    sub: isNew ? `Volume ${book.volume_id} · Book ${book.book_no}` : h('span', {},
      `Volume ${book.volume_id} · Book ${book.book_no}${chapterNo ? ` · Chapter ${chapterNo}` : ''}${row.page_start ? ` · page ${row.page_start}${row.page_end && row.page_end !== row.page_start ? '–' + row.page_end : ''}` : ''} · id ${row.id} `,
      row.needs_review ? h('span', { class: 'pill warn' }, 'Needs review') : null),
    actions: isNew ? [] : [
      historyLink,
      h('button', { class: 'btn danger', type: 'button', onclick: (e) => remove(e.currentTarget) }, icon('trash'), 'Delete'),
      h('span', { class: 'joined' },
        h(data.prev ? 'a' : 'button', { class: 'btn icon', href: data.prev ? `#/h/${data.prev}` : null, disabled: data.prev ? null : true, 'aria-label': 'Previous hadith', title: 'Previous hadith', style: 'border-radius:6px 0 0 6px' }, icon('left')),
        h(data.next ? 'a' : 'button', { class: 'btn icon', href: data.next ? `#/h/${data.next}` : null, disabled: data.next ? null : true, 'aria-label': 'Next hadith', title: 'Next hadith' }, icon('right'))),
    ],
  });

  const notices = [
    !isNew && data.pending ? h('div', { class: 'notice' }, 'The AI search has not caught up with the last change of this hadith yet. It is retried automatically (AI search in the menu).') : null,
  ];

  const section = (title, ...kids) => h('div', { class: 'form-section' }, h('h2', {}, title), ...kids);
  const byCol = Object.fromEntries(FIELDS.map((f) => [f[0], f]));
  const fieldOf = (col) => { const [c, label, kind, hint] = byCol[col]; return field(c, label, input(c, kind), hint); };
  const form = h('form', { onsubmit: save, novalidate: true, class: 'panel' },
    section('Text', fieldOf('arabic_text'), fieldOf('malayalam_text'), fieldOf('explanation_ml')),
    section('Narrator and sources',
      h('div', { class: 'grid2' }, fieldOf('narrator_ar'), fieldOf('narrator_ml')),
      h('div', { class: 'grid2' }, fieldOf('source_codes_ar'), fieldOf('source_codes_ml')),
      h('div', { class: 'grid2' }, fieldOf('grading_note_ar'), fieldOf('grading_note_ml'))),
    section('Number and place',
      h('div', { class: 'grid4' },
        field('hadith_no', 'Hadith number', ctl.hadith_no, 'Unique in the book'),
        field('hadith_label', 'Label', ctl.hadith_label, 'Only if the book prints no number'),
        field('page_start', 'First page', ctl.page_start),
        field('page_end', 'Last page', ctl.page_end)),
      field('chapter_id', 'Chapter', ctl.chapter_id)),
    section('Variants (وفي رواية)', variantBox,
      h('button', { class: 'btn', type: 'button', onclick: () => { variants.push({ arabic_text: '', malayalam_text: '' }); drawVariants(); refresh(); } }, icon('plus'), 'Add variant')),
    section('Review',
      h('label', { class: 'check' }, ctl.needs_review, 'Needs review (flagged as uncertain)'),
      h('div', { class: 'field', style: 'margin:16px 0 0' }, h('label', { for: 'f-note' }, 'Note for the history'), note,
        h('span', { class: 'hint' }, 'Optional. Shown in History next to this change.'))),
    h('div', { class: 'savebar', style: 'padding:12px 20px' }, saveBtn, status));

  root.replaceChildren(head, ...notices.filter(Boolean), h('div', { class: 'editor' }, form, preview));
  refresh();
}

function embedMsg(embed) {
  if (!embed) return '';
  if (embed.error) return ' AI search will be updated later.';
  return embed.left ? ` AI search: ${embed.left} hadith still waiting.` : ' AI search updated.';
}
