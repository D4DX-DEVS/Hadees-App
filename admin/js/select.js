// Editor admin page: every <select> gets a styled dropdown (button + list) instead of the browser's own popup.
// The real <select> stays in the page (hidden), so forms, .value and "change" events work exactly as before;
// the list is keyboard friendly (arrows, Home/End, Enter, Esc, type to jump) and is read as a listbox by screen readers.
import { h } from './core.js';

let uid = 0;
let openOne = null;          // the dropdown that is open now: { close }

/** turn one <select> into a styled dropdown (once) */
function enhance(sel) {
  if (sel.dataset.dd || sel.multiple || sel.size > 1) return;
  sel.dataset.dd = '1';
  const id = `dd${++uid}`;
  const label = h('span', { class: 'dd-label' });
  const btn = h('button', { type: 'button', class: `dd-btn ${sel.className}`, 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-controls': `${id}-list` },
    label, h('span', { class: 'dd-caret', 'aria-hidden': 'true' }));
  const list = h('div', { class: 'dd-list', id: `${id}-list`, role: 'listbox', tabindex: '-1', hidden: true });
  const wrap = h('span', { class: 'dd' });
  // the select's accessible name moves to the button
  const name = sel.getAttribute('aria-label') || (sel.id && document.querySelector(`label[for="${sel.id}"]`)?.textContent) || '';
  if (name) btn.setAttribute('aria-label', `${name}: ${sel.selectedOptions[0]?.textContent ?? ''}`);
  if (sel.id) document.querySelectorAll(`label[for="${sel.id}"]`).forEach((l) => l.addEventListener('click', (e) => { e.preventDefault(); btn.focus(); }));
  sel.parentNode.insertBefore(wrap, sel);
  wrap.append(sel, btn, list);
  sel.classList.add('dd-native');
  sel.tabIndex = -1;
  sel.setAttribute('aria-hidden', 'true');

  let active = -1;
  const opts = () => [...sel.options];
  const sync = () => {
    const o = sel.selectedOptions[0];
    label.textContent = o ? o.textContent : '';
    label.classList.toggle('dd-placeholder', !o || o.value === '');
    btn.disabled = sel.disabled;
    if (name) btn.setAttribute('aria-label', `${name}: ${label.textContent}`);
  };
  const draw = () => {
    list.replaceChildren(...opts().map((o, i) => h('div', {
      class: `dd-opt${o.selected ? ' on' : ''}${o.value === '' ? ' dd-placeholder' : ''}`, role: 'option', id: `${id}-${i}`,
      'aria-selected': o.selected ? 'true' : 'false', 'aria-disabled': o.disabled ? 'true' : null,
      onmousedown: (e) => e.preventDefault(),          // keep focus on the button
      onclick: () => { if (!o.disabled) choose(i); },
      onmousemove: () => mark(i),
    }, h('span', {}, o.textContent), o.selected ? h('span', { class: 'dd-tick', 'aria-hidden': 'true' }) : null)));
  };
  const mark = (i) => {
    const items = list.children;
    if (!items.length) return;
    active = Math.max(0, Math.min(items.length - 1, i));
    [...items].forEach((el, j) => el.classList.toggle('act', j === active));
    btn.setAttribute('aria-activedescendant', `${id}-${active}`);
    items[active].scrollIntoView({ block: 'nearest' });
  };
  const place = () => {
    const r = btn.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    list.classList.toggle('up', below < 260 && r.top > below);
  };
  const open = () => {
    if (btn.disabled) return;
    openOne?.close();
    draw();
    list.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    wrap.classList.add('open');
    place();
    mark(Math.max(0, sel.selectedIndex));
    openOne = { close };
  };
  function close() {
    list.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    btn.removeAttribute('aria-activedescendant');
    wrap.classList.remove('open');
    if (openOne?.close === close) openOne = null;
  }
  function choose(i) {
    const changed = sel.selectedIndex !== i;
    sel.selectedIndex = i;
    sync();
    close();
    btn.focus();
    if (changed) {
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  let typed = '', typedAt = 0;
  btn.addEventListener('click', () => (list.hidden ? open() : close()));
  btn.addEventListener('blur', () => setTimeout(() => { if (!wrap.contains(document.activeElement)) close(); }, 0));
  btn.addEventListener('keydown', (e) => {
    const isOpen = !list.hidden;
    const n = sel.options.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) { open(); return; }
      mark(active + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Home' || e.key === 'End') {
      if (isOpen) { e.preventDefault(); mark(e.key === 'Home' ? 0 : n - 1); }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (isOpen && active >= 0) choose(active); else open();
    } else if (e.key === 'Escape') {
      if (isOpen) { e.preventDefault(); e.stopPropagation(); close(); }
    } else if (e.key === 'Tab') {
      close();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      typed = now - typedAt > 700 ? e.key.toLowerCase() : typed + e.key.toLowerCase();
      typedAt = now;
      const hit = opts().findIndex((o) => o.textContent.trim().toLowerCase().startsWith(typed));
      if (hit >= 0) { if (isOpen) mark(hit); else choose(hit); }
    }
  });
  // code that changes the select (value set, options replaced, disabled) keeps the button in step
  sel.addEventListener('change', sync);
  new MutationObserver(sync).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  Object.defineProperty(sel, 'value', { configurable: true, get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); sync(); } });
  sync();
}

/** enhance every <select> now and whenever new ones are added to the page */
export function installSelects(root = document.body) {
  root.querySelectorAll('select').forEach(enhance);
  new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'SELECT') enhance(node);
        else node.querySelectorAll?.('select').forEach(enhance);
      });
    }
  }).observe(root, { childList: true, subtree: true });
  document.addEventListener('mousedown', (e) => { if (openOne && !e.target.closest('.dd')) openOne.close(); });
  window.addEventListener('resize', () => openOne?.close());
}
