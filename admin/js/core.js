// Editor admin page: small shared helpers. No framework, no innerHTML with data (everything goes through h()).

/** create an element: h('a', {href: '#/', class: 'x', onclick: fn}, 'text', child, [more]) */
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k === 'style') el.style.cssText = String(v); // CSSOM, allowed by the CSP (a style attribute is not)
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  const add = (c) => {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}

// ───────── API ─────────
export const session = { csrf: '', user: '', pending: 0 };
const listeners = new Set();
export const onPending = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export function setPending(n) {
  if (typeof n !== 'number') return;
  session.pending = n;
  listeners.forEach((fn) => fn(n));
}

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

/** GET when body is undefined, POST otherwise */
export async function api(action, params = {}, body) {
  const qs = new URLSearchParams({ a: action, ...params });
  const opts = { credentials: 'same-origin', headers: {} };
  if (body !== undefined) {
    opts.method = 'POST';
    opts.headers['Content-Type'] = 'application/json';
    opts.headers['X-CSRF-Token'] = session.csrf;
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`api.php?${qs}`, opts);
  } catch {
    throw new ApiError('No connection to the server. Check the internet and try again.', 0);
  }
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  if (res.status === 401 && action !== 'login') {
    window.dispatchEvent(new CustomEvent('hv-logout'));
  }
  if (!res.ok) throw new ApiError(data?.error || `Server error (${res.status})`, res.status);
  if (data && typeof data.pending === 'number') setPending(data.pending);
  return data;
}

// ───────── feedback ─────────
export function toast(text, kind = '') {
  const t = h('div', { class: `toast ${kind}` }, text);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), kind === 'err' ? 7000 : 3500);
}

/**
 * Confirmation dialog; resolves true when confirmed.
 * danger = red confirm button; items = the changes listed in the dialog (e.g. the fields that will be saved);
 * kind = 'save' | 'delete' | 'logout' | 'leave' picks the icon. Esc, Cancel or a click outside = no.
 */
export function confirmBox({ title, text, ok = 'Confirm', danger = false, items = [], kind = danger ? 'delete' : 'save' }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const close = (v) => { ov.remove(); document.removeEventListener('keydown', key, true); prev?.focus?.(); resolve(v); };
    const okBtn = h('button', { class: `btn ${danger ? 'danger solid' : 'primary'}`, type: 'button', onclick: () => close(true) }, ok);
    const cancelBtn = h('button', { class: 'btn', type: 'button', onclick: () => close(false) }, 'Cancel');
    const key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
      else if (e.key === 'Tab') {                       // keep the focus inside the dialog
        const f = [cancelBtn, okBtn];
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus();
      }
    };
    const ic = { save: 'check', delete: 'trash', logout: 'logout', leave: 'alert' }[kind] || 'alert';
    const ov = h('div', { class: 'overlay', onclick: (e) => { if (e.target === ov) close(false); } },
      h('div', { class: 'modal', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'mt', 'aria-describedby': 'md' },
        h('div', { class: `modal-ic ${danger ? 'bad' : kind === 'leave' ? 'warn' : 'ok'}`, 'aria-hidden': 'true' }, icon(ic)),
        h('h3', { id: 'mt' }, title),
        h('p', { class: 'muted', id: 'md' }, text),
        items.length ? h('ul', { class: 'modal-list' }, items.slice(0, 12).map((x) => h('li', {}, x)),
          items.length > 12 ? h('li', { class: 'muted' }, `and ${items.length - 12} more`) : null) : null,
        h('div', { class: 'row' }, cancelBtn, okBtn)));
    document.body.append(ov);
    document.addEventListener('keydown', key, true);
    (danger ? cancelBtn : okBtn).focus();               // a destructive action never runs on a stray Enter
  });
}

/** ask before saving: "Save 3 changes?" with the changed fields listed */
export const confirmSave = (labels, { isNew = false, what = 'this' } = {}) => confirmBox({
  title: isNew ? `Add ${what}?` : `Save ${labels.length} change${labels.length === 1 ? '' : 's'}?`,
  text: isNew ? 'It goes live on the website and in the app. History keeps it, and Undo removes it again.'
    : 'The new version goes live on the website and in the app. History keeps the old one, and Undo brings it back.',
  ok: isNew ? 'Add' : 'Save', items: labels, kind: 'save',
});

/** run an async action from a button: disables it and shows a spinner while it runs */
export async function busy(btn, fn) {
  if (btn.disabled) return undefined;
  const label = [...btn.childNodes];
  btn.disabled = true;
  btn.replaceChildren(h('span', { class: 'spin', 'aria-hidden': 'true' }), 'Working…');
  try {
    return await fn();
  } catch (e) {
    toast(e.message || String(e), 'err');
    return undefined;
  } finally {
    btn.disabled = false;
    btn.replaceChildren(...label);
  }
}

// ───────── icons (outline, 16px, one set) ─────────
const ICONS = {
  library: ['M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z', 'M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z'],
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'm21 21-4.3-4.3'],
  flag: ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7'],
  article: ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z', 'M14 2v5h5', 'M16 13H8', 'M16 17H8', 'M10 9H8'],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  history: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5', 'M12 7v5l4 2'],
  sparkles: ['m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
  external: ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
  left: ['m15 18-6-6 6-6'], right: ['m9 18 6-6-6-6'],
  plus: ['M5 12h14', 'M12 5v14'],
  trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'],
  undo: ['M3 7v6h6', 'M21 17a9 9 0 0 0-15-6.7L3 13'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  up: ['m5 12 7-7 7 7', 'M12 19V5'], down: ['M12 5v14', 'm19 12-7 7-7-7'],
  check: ['M20 6 9 17l-5-5'],
  lock: ['M5 11h14v10H5z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  tag: ['M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z', 'M7.5 7.5h.01'],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  'eye-off': ['M9.9 4.2A10.9 10.9 0 0 1 12 4c6.4 0 10 8 10 8a18.5 18.5 0 0 1-2.2 3.2', 'M6.6 6.6A18.7 18.7 0 0 0 2 12s3.6 8 10 8a10.6 10.6 0 0 0 5.4-1.4', 'M9.9 9.9a3 3 0 0 0 4.2 4.2', 'm2 2 20 20'],
  languages: ['m5 8 6 6', 'm4 14 6-6 2-3', 'M2 5h12', 'M7 2h1', 'm22 22-5-10-5 10', 'M14 18h6'],
  book: ['M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20'],
  globe: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'],
  sun: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v2', 'M12 20v2', 'm4.9 4.9 1.4 1.4', 'm17.7 17.7 1.4 1.4', 'M2 12h2', 'M20 12h2', 'm6.3 17.7-1.4 1.4', 'm19.1 4.9-1.4 1.4'],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z'],
  home: ['M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  hash: ['M4 9h16', 'M4 15h16', 'M10 3 8 21', 'M16 3l-2 18'],
  alert: ['M12 9v4', 'M12 17h.01', 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'],
};
const SVG = 'http://www.w3.org/2000/svg';
export function icon(name, label) {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'i');
  if (label) { s.setAttribute('role', 'img'); s.setAttribute('aria-label', label); } else s.setAttribute('aria-hidden', 'true');
  for (const d of ICONS[name] || []) {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    s.append(p);
  }
  return s;
}

/** the product's mark: an open book in the app's green (drawn, not a letter in a square) */
export function mark() {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', '0 0 28 28');
  s.setAttribute('class', 'mark');
  s.setAttribute('aria-hidden', 'true');
  const add = (tag, attrs) => { const e = document.createElementNS(SVG, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); s.append(e); };
  add('rect', { x: 0, y: 0, width: 28, height: 28, rx: 7, fill: 'var(--accent)' });
  add('path', { d: 'M6 9.5c2.6-.9 5.3-.6 8 1.1 2.7-1.7 5.4-2 8-1.1v10c-2.6-.9-5.3-.6-8 1.1-2.7-1.7-5.4-2-8-1.1z', fill: 'none', stroke: '#fff', 'stroke-width': 1.6, 'stroke-linejoin': 'round' });
  add('path', { d: 'M14 10.6v10', stroke: '#fff', 'stroke-width': 1.6 });
  return s;
}

// ───────── states ─────────
/** loading: the final layout with grey bars at the rows' real height, no shimmer */
export const skeleton = (n = 6) => h('div', { 'aria-busy': 'true', 'aria-label': 'Loading' }, Array.from({ length: n }, (_, i) =>
  h('div', { class: 'sk-row' }, h('span', { class: 'sk', style: 'width:40px' }), h('span', { class: 'sk', style: `width:${55 + ((i * 37) % 40)}%` }), h('span', { class: 'sk', style: 'width:60px' }))));
export const emptyState = (text, action) => h('div', { class: 'empty' }, h('p', { style: 'margin:0 0 8px' }, text), action || null);
export function errorState(err, retry) {
  return h('div', { class: 'notice err', role: 'alert' },
    icon('alert'),
    h('p', {}, err.message || String(err)),
    retry ? h('button', { class: 'btn', onclick: retry }, 'Retry') : null);
}

// ───────── pagination (server-side; the URL holds page + pageSize, so reload / back / sharing keep the view) ─────────
export const PAGE_SIZES = [10, 20, 50, 100];
/** change query parameters of the current hash route; any change other than the page itself goes back to page 1 */
export function setQuery(changes) {
  const [path, query = ''] = location.hash.split('?');
  const p = new URLSearchParams(query);
  if (!('page' in changes)) p.delete('page');
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === '' || v === undefined) p.delete(k); else p.set(k, String(v));
  }
  const qs = p.toString();
  location.hash = qs ? `${path}?${qs}` : path;
}
export function pageParams() {
  const p = new URLSearchParams(location.hash.split('?')[1] || '');
  const size = Number(p.get('pageSize'));
  return { page: Math.max(1, Number(p.get('page')) || 1), pageSize: PAGE_SIZES.includes(size) ? size : 20 };
}

/** Previous / Page x of y / Next, the total, and rows per page (10 / 20 / 50 / 100) */
export function pager(res, noun = 'results') {
  const from = res.total ? (res.page - 1) * res.pageSize + 1 : 0;
  const to = Math.min(res.total, res.page * res.pageSize);
  const size = h('select', { 'aria-label': 'Rows per page', onchange: (e) => setQuery({ pageSize: e.target.value }) },
    PAGE_SIZES.map((n) => h('option', { value: n, selected: n === res.pageSize ? true : null }, `${n} per page`)));
  return h('nav', { class: 'pager', 'aria-label': 'Pages' },
    h('span', { class: 'grow num' }, res.total ? `${from.toLocaleString()}–${to.toLocaleString()} of ${res.total.toLocaleString()} ${noun}` : `0 ${noun}`),
    size,
    h('button', { class: 'btn', type: 'button', disabled: res.page <= 1 ? true : null, onclick: () => setQuery({ page: res.page - 1 }), 'aria-label': 'Previous page' }, icon('left'), 'Previous'),
    h('span', { class: 'pos' }, `Page ${res.page} of ${res.totalPages}`),
    h('button', { class: 'btn', type: 'button', disabled: res.page >= res.totalPages ? true : null, onclick: () => setQuery({ page: res.page + 1 }), 'aria-label': 'Next page' }, 'Next', icon('right')));
}

/**
 * A paged list inside a panel: skeleton while loading (pageSize rows, max 10), the rows, the pager; empty and error states.
 * opts: { action, params, item(row), empty, noun, onData(res) }
 */
export function pagedList(opts) {
  const box = h('div', { class: 'panel' });
  const { page, pageSize } = pageParams();
  const run = async () => {
    box.replaceChildren(skeleton(Math.min(pageSize, 10)));
    try {
      const res = await api(opts.action, { ...opts.params, page, pageSize });
      opts.onData?.(res);
      if (!res.total) { box.replaceChildren(emptyState(opts.empty || 'Nothing here.')); return; }
      box.replaceChildren(h('div', { class: 'rows' }, res.data.map(opts.item)), pager(res, opts.noun));
    } catch (e) {
      box.replaceChildren(h('div', { class: 'pb' }, errorState(e, run)));
    }
  };
  run();
  return box;
}

/** load data into a container with skeleton / error / render */
export async function load(container, fetcher, render, rows = 6) {
  container.replaceChildren(skeleton(rows));
  try {
    const data = await fetcher();
    container.replaceChildren(render(data));
  } catch (e) {
    container.replaceChildren(errorState(e, () => load(container, fetcher, render, rows)));
  }
}

// ───────── labels ─────────
export const hadithRef = (r) => `Vol ${r.volume_id} · Book ${r.book_no} · ${r.hadith_label || 'Hadith ' + r.hadith_no}`;
export const fmtTime = (s) => new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const GRADE_SHORT = { sahih: 'Sahih', sahih_li_ghairihi: 'Sahih li-ghairihi', hasan_sahih: 'Hasan Sahih', hasan: 'Hasan',
  hasan_li_ghairihi: 'Hasan li-ghairihi', daif: 'Da‘if', very_daif: 'Very weak', mawdu: 'Mawdu‘' };

/** one hadith row in a list: its number, the first words, where it sits, and its state */
export function hadithItem(r) {
  return h('a', { href: `#/h/${r.id}` },
    h('span', { class: 'no' }, r.hadith_label || `No. ${r.hadith_no}`),
    h('span', { class: 'txt' },
      h('span', { class: 'snip', style: 'display:block' }, r.snippet || '—'),
      h('span', { class: 'ref', style: 'display:block' }, `Volume ${r.volume_id} · Book ${r.book_no}${r.chapter_no ? ' · Chapter ' + r.chapter_no : ''}`)),
    h('span', { class: 'tags' },
      r.grade ? h('span', { class: `pill ${/daif|mawdu/.test(r.grade) ? 'bad' : /hasan/.test(r.grade) ? 'info' : 'ok'}` }, GRADE_SHORT[r.grade] || r.grade) : null,
      r.needs_review ? h('span', { class: 'pill warn' }, 'Needs review') : null,
      r.pending ? h('span', { class: 'pill' }, 'AI search waiting') : null));
}

/** page head: breadcrumb, h1, one line about the data, actions on the right */
export function pageHead({ crumbs = [], title, titleClass = '', sub = null, actions = [] }) {
  return h('div', {},
    crumbs.length ? h('div', { class: 'crumbs' }, crumbs.flatMap((c, i) => [i ? sep() : null, c])) : null,
    h('div', { class: 'head' },
      h('div', { class: 't' }, h('h1', { class: titleClass }, title), sub ? h('p', { class: 'sub' }, sub) : null),
      actions.length ? h('div', { class: 'actions' }, actions) : null));
}

// ───────── word diff (history) ─────────
/** word-level diff of two strings -> nodes with <del>/<ins>; falls back to whole blocks for very long texts */
export function wordDiff(a, b) {
  a = a ?? ''; b = b ?? '';
  const A = String(a).split(/(\s+)/), B = String(b).split(/(\s+)/);
  if (A.length * B.length > 4_000_000) return [h('del', {}, a), ' ', h('ins', {}, b)];
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  const push = (tag, s) => {
    const last = out[out.length - 1];
    if (last && last.tag === tag) last.s += s; else out.push({ tag, s });
  };
  while (i < n && j < m) {
    if (A[i] === B[j]) { push('', A[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) push('del', A[i++]);
    else push('ins', B[j++]);
  }
  while (i < n) push('del', A[i++]);
  while (j < m) push('ins', B[j++]);
  return out.map((p) => (p.tag ? h(p.tag, {}, p.s) : document.createTextNode(p.s)));
}

/** breadcrumb separator (its own element, so the text on both sides keeps its spacing) */
export const sep = () => h('span', { 'aria-hidden': 'true' }, '›');
