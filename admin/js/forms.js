// Editor admin page: a small form that edits some columns of one row (books, chapters, articles, blocks, narrators).
import { api, busy, confirmSave, h, toast } from './core.js';

/**
 * fields: [[column, label, kind, hint?]], kind = text | ml | ar | ml-area | ar-area | int | select:<a,b,c> | json
 * opts: { tbl, id, ver, row, onSaved(res), submitLabel, compact, isNew, create: {parentFields} }
 * Returns { el, isDirty }.
 */
export function rowForm(fields, opts) {
  const { tbl, row } = opts;
  let ver = opts.ver;
  let saved = { ...row };
  const ctl = {};
  const show = (col, kind, v) => (kind === 'json' ? (v == null ? '' : JSON.stringify(v, null, 1)) : v ?? '');

  const make = (col, kind) => {
    const id = `rf-${tbl}-${opts.id ?? 'new'}-${col}`;
    const v = show(col, kind, row[col]);
    let el;
    if (kind.startsWith('select:')) {
      el = h('select', { id }, kind.slice(7).split(',').map((o) => h('option', { value: o, selected: o === v ? true : null }, o)));
    } else if (kind.endsWith('-area') || kind === 'json') {
      const cls = kind.startsWith('ar') ? 'ar' : kind.startsWith('ml') ? 'ml' : '';
      el = h('textarea', { id, class: cls, dir: cls === 'ar' ? 'rtl' : 'auto', rows: kind === 'json' ? 6 : opts.compact ? 3 : 6, value: v });
    } else {
      const cls = kind === 'ar' ? 'ar' : kind === 'ml' ? 'ml' : '';
      el = h('input', { id, type: kind === 'int' ? 'number' : 'text', min: kind === 'int' ? 0 : null, class: cls, dir: cls === 'ar' ? 'rtl' : 'auto', value: v });
    }
    el.addEventListener('input', refresh);
    el.addEventListener('change', refresh);
    ctl[col] = { el, kind };
    return el;
  };

  const value = (col) => {
    const { el, kind } = ctl[col];
    if (kind === 'json') {
      if (el.value.trim() === '') return null;
      try { return JSON.parse(el.value); } catch { return el.value; }      // server answers "must be a JSON list"
    }
    return el.value;
  };
  const changed = () => {
    const out = {};
    for (const [col, { kind }] of Object.entries(ctl)) {
      const before = show(col, kind, saved[col]);
      const now = ctl[col].el.value;
      if (String(before) !== String(now)) out[col] = value(col);
    }
    return out;
  };
  const isDirty = () => Object.keys(changed()).length > 0;

  const btn = h('button', { class: 'btn primary', type: 'submit' }, opts.submitLabel || 'Save');
  function refresh() {
    const c = opts.isNew ? {} : changed();
    for (const [col, { el }] of Object.entries(ctl)) el.classList.toggle('dirty', col in c);
    if (!opts.isNew) btn.disabled = Object.keys(c).length === 0;
  }

  const labelOf = Object.fromEntries(fields.map(([col, label]) => [col, label]));
  async function submit(e) {
    e.preventDefault();
    if (btn.disabled) return;
    const labels = opts.isNew ? [] : Object.keys(changed()).map((c) => labelOf[c] || c);
    if (!opts.isNew && !labels.length) { toast('Nothing to save.'); return; }
    if (!(await confirmSave(labels, { isNew: opts.isNew, what: opts.what || 'this' }))) return;
    await busy(btn, async () => {
      if (opts.isNew) {
        const all = {};
        for (const col of Object.keys(ctl)) all[col] = value(col);
        const res = await api('create', {}, { tbl, fields: { ...all, ...(opts.create || {}) } });
        toast('Added.');
        opts.onSaved?.(res);
        return;
      }
      const res = await api('save', {}, { tbl, id: opts.id, ver, fields: changed() });
      ver = res.ver;
      saved = res.row;
      toast(res.changed.length ? 'Saved.' : 'Nothing to save.');
      refresh();
      opts.onSaved?.(res);
    });
  }

  const inputs = fields.map(([col, label, kind, hint]) => {
    const input = make(col, kind);
    return h('div', { class: 'field' }, h('label', { for: input.id }, label), input, hint ? h('span', { class: 'hint' }, hint) : null);
  });
  const el = opts.compact
    ? h('form', { onsubmit: submit, novalidate: true }, inputs, h('div', { class: 'row' }, btn, ...(opts.extra || [])))
    : h('form', { onsubmit: submit, novalidate: true, class: 'panel' },
      opts.title ? h('div', { class: 'ph' }, h('h2', {}, opts.title)) : null,
      h('div', { class: 'pb' }, inputs, opts.note ? h('p', { class: 'small muted', style: 'margin:0' }, opts.note) : null),
      h('div', { class: 'pf' }, btn, ...(opts.extra || [])));
  refresh();
  return { el, isDirty, getVer: () => ver };
}
