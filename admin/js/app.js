// Editor admin page: login, the shell (tinted frame + white sheet), routing (#/...), unsaved-change guard.
import { api, busy, confirmBox, h, icon, mark, onPending, session, toast } from './core.js';
import { hadithView, newHadithView } from './hadith.js';
import { bookHadithsView, bookView, chapterView, homeView, pendingView, reviewView, searchView, volumeView } from './views.js';
import { articleView, articlesView, editView, historyView, narratorView, narratorsView } from './views2.js';

const app = document.getElementById('app');

// ───────── unsaved changes ─────────
let leaveGuard = null;
/** the current screen registers a function that says whether it has unsaved changes */
export function setLeaveGuard(fn) { leaveGuard = fn; }
const hasUnsaved = () => { try { return !!leaveGuard?.(); } catch { return false; } };
window.addEventListener('beforeunload', (e) => { if (hasUnsaved()) { e.preventDefault(); e.returnValue = ''; } });

export function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

// ───────── routes ─────────
const ROUTES = [
  [/^#?\/?$/, (m, root) => homeView(root), 'library', 'Library'],
  [/^#\/v\/(\d+)$/, (m, root) => volumeView(root, m[1]), 'library', 'Volume'],
  [/^#\/b\/(\d+)$/, (m, root) => bookView(root, m[1]), 'library', 'Book'],
  [/^#\/bh\/(\d+)$/, (m, root) => bookHadithsView(root, m[1]), 'library', 'Book'],
  [/^#\/c\/(\d+)$/, (m, root) => chapterView(root, m[1]), 'library', 'Chapter'],
  [/^#\/h\/(\d+)$/, (m, root) => hadithView(root, m[1]), 'library', 'Hadith'],
  [/^#\/new$/, (m, root, p) => newHadithView(root, p), 'library', 'New hadith'],
  [/^#\/search$/, (m, root, p) => searchView(root, p), 'search', 'Search'],
  [/^#\/review$/, (m, root) => reviewView(root), 'review', 'Needs review'],
  [/^#\/pending$/, (m, root) => pendingView(root), 'pending', 'AI search'],
  [/^#\/history$/, (m, root, p) => historyView(root, p), 'history', 'History'],
  [/^#\/edit\/(\d+)$/, (m, root) => editView(root, m[1]), 'history', 'Edit'],
  [/^#\/articles$/, (m, root) => articlesView(root), 'articles', 'Articles'],
  [/^#\/a\/(\d+)$/, (m, root) => articleView(root, m[1]), 'articles', 'Article'],
  [/^#\/narrators$/, (m, root) => narratorsView(root), 'narrators', 'Narrators'],
  [/^#\/n\/(\d+)$/, (m, root) => narratorView(root, m[1]), 'narrators', 'Narrator'],
];

/** [key, href, label, icon] in groups */
const NAV = [
  [null, [['library', '#/', 'Library', 'library'], ['review', '#/review', 'Needs review', 'flag'], ['search', '#/search', 'Search', 'search']]],
  ['Pages', [['articles', '#/articles', 'Articles', 'article'], ['narrators', '#/narrators', 'Narrators', 'users']]],
  ['Changes', [['history', '#/history', 'History', 'history'], ['pending', '#/pending', 'AI search', 'sparkles']]],
];

let shell = null;      // { main, links, root, title, status }
let lastHash = location.hash;

function aiStatus(el, n) {
  el.classList.toggle('wait', n > 0);
  el.replaceChildren(h('span', { class: 'dot' }), n > 0 ? `AI search: ${n} waiting` : 'AI search up to date');
}

function buildShell() {
  const links = {};
  const pendingCount = h('span', { class: 'count', hidden: true });
  const nav = h('nav', { class: 'nav', 'aria-label': 'Main' }, NAV.flatMap(([group, items]) => [
    group ? h('div', { class: 'nav-group' }, group) : null,
    ...items.map(([key, href, label, ic]) => {
      const a = h('a', { href }, icon(ic), h('span', {}, label), key === 'pending' ? pendingCount : null);
      links[key] = a;
      return a;
    }),
  ]));
  const logoutBtn = h('button', { class: 'btn ghost icon', 'aria-label': 'Log out', title: 'Log out' }, icon('logout'));
  logoutBtn.addEventListener('click', () => busy(logoutBtn, async () => {
    if (hasUnsaved() && !(await confirmBox({ title: 'Log out?', text: 'This page has changes that are not saved yet. They will be lost.', ok: 'Log out', danger: true }))) return;
    await api('logout', {}, {});
    session.csrf = '';
    leaveGuard = null;
    showLogin();
  }));

  // top bar: search across the library, the AI search state, a link to the live site
  const q = h('input', { type: 'search', placeholder: 'Search hadith, narrators, or #id', 'aria-label': 'Search the library' });
  const searchForm = h('form', { class: 'search', role: 'search', onsubmit: (e) => { e.preventDefault(); if (q.value.trim()) go(`#/search?q=${encodeURIComponent(q.value.trim())}`); } },
    icon('search'), q, h('kbd', {}, '/'));
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) { e.preventDefault(); q.focus(); }
  });
  const status = h('a', { class: 'status', href: '#/pending' });
  aiStatus(status, session.pending);
  onPending((n) => { aiStatus(status, n); pendingCount.hidden = !n; pendingCount.textContent = String(n); });
  pendingCount.hidden = !session.pending;
  pendingCount.textContent = String(session.pending);

  const title = h('b', {});
  const root = h('div', { class: 'shell' },
    h('aside', { class: 'side', 'aria-label': 'Navigation' },
      h('a', { class: 'brand', href: '#/' }, mark(), h('div', {}, h('b', {}, 'Hadees Vijnanakosham'), h('small', {}, 'Editor · 4 volumes'))),
      nav,
      h('div', { class: 'foot' },
        h('span', { class: 'avatar', 'aria-hidden': 'true' }, (session.user || 'E').slice(0, 1).toUpperCase()),
        h('span', { class: 'who' }, h('b', {}, session.user), h('span', {}, 'Editor')),
        logoutBtn)),
    h('header', { class: 'top' },
      h('div', { class: 'topbar-phone' },
        h('button', { class: 'btn ghost icon', 'aria-label': 'Menu', onclick: () => root.classList.toggle('menu-open') }, icon('menu')),
        title),
      searchForm,
      h('div', { class: 'right' }, status,
        h('a', { class: 'btn ghost icon', href: '/', target: '_blank', rel: 'noopener', title: 'Open the website', 'aria-label': 'Open the website' }, icon('external')))),
    h('div', { class: 'sheet', id: 'sheet' }, h('main', { class: 'main', id: 'main', tabindex: '-1' })));
  root.querySelector('.side').addEventListener('click', (e) => { if (e.target.closest('a')) root.classList.remove('menu-open'); });
  root.addEventListener('click', (e) => {
    if (root.classList.contains('menu-open') && !e.target.closest('.side') && !e.target.closest('.top')) root.classList.remove('menu-open');
  });
  app.replaceChildren(root);
  return { main: root.querySelector('#main'), sheet: root.querySelector('#sheet'), links, root, title, q };
}

function route() {
  if (!shell) return;
  const [path, query = ''] = location.hash.split('?');
  const params = new URLSearchParams(query);
  leaveGuard = null;
  shell.root.classList.remove('menu-open');
  for (const [re, view, key, name] of ROUTES) {
    const m = path.match(re);
    if (m) {
      Object.entries(shell.links).forEach(([k, a]) => { a.classList.toggle('on', k === key); a.toggleAttribute('aria-current', k === key); });
      shell.title.textContent = name;
      if (key !== 'search') shell.q.value = '';
      shell.main.replaceChildren();
      view(m, shell.main, params);
      shell.sheet.scrollTo(0, 0);
      window.scrollTo(0, 0);
      return;
    }
  }
  shell.main.replaceChildren(h('h1', {}, 'Not found'), h('p', {}, h('a', { href: '#/' }, 'Back to the library')));
}

let leaving = false;
window.addEventListener('hashchange', async () => {
  if (leaving) return;
  if (hasUnsaved()) {
    const target = location.hash;
    history.replaceState(null, '', lastHash || '#/');      // stay until the editor decides
    leaving = true;
    const ok = await confirmBox({ title: 'Leave without saving?', text: 'This page has changes that are not saved yet. They will be lost.', ok: 'Leave', danger: true });
    leaving = false;
    if (!ok) return;
    leaveGuard = null;
    history.replaceState(null, '', target);
  }
  lastHash = location.hash;
  route();
});

// ───────── login: the frame on the left, the form on a white sheet ─────────
function showLogin(message = '') {
  shell = null;
  const user = h('input', { id: 'lu', type: 'text', autocomplete: 'username', required: true });
  const pass = h('input', { id: 'lp', type: 'password', autocomplete: 'current-password', required: true });
  const err = h('p', { class: 'err', role: 'alert' }, message);
  const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Log in');
  const form = h('form', { novalidate: true, onsubmit: (e) => {
    e.preventDefault();
    err.textContent = '';
    if (!user.value.trim() || !pass.value) { err.textContent = 'Enter the username and the password.'; return; }
    busy(btn, async () => {
      try {
        const r = await api('login', {}, { user: user.value, pass: pass.value });
        session.csrf = r.csrf;
        session.user = r.user;
        start();
      } catch (e2) {
        err.textContent = e2.message;
        pass.value = '';
        pass.focus();
      }
    });
  } },
  h('h1', {}, 'Log in to the editor'),
  h('p', { class: 'sub' }, 'Corrections made here go live on the website and in the app.'),
  h('div', { class: 'field' }, h('label', { for: 'lu' }, 'Username'), user),
  h('div', { class: 'field' }, h('label', { for: 'lp' }, 'Password'), pass),
  err, btn,
  h('p', { class: 'note' }, icon('lock'), 'Every change is kept in History and can be undone.'));

  app.replaceChildren(h('div', { class: 'login' },
    h('div', { class: 'aside' },
      h('div', { class: 'brand' }, mark(), h('div', {}, h('b', {}, 'Hadees Vijnanakosham'), h('small', {}, 'ഹദീസ് വിജ്ഞാനകോശം'))),
      h('div', { class: 'quote' },
        h('p', { class: 'ar', lang: 'ar', dir: 'rtl' }, 'نَضَّرَ اللَّهُ امْرَأً سَمِعَ مِنَّا حَدِيثًا فَحَفِظَهُ حَتَّى يُبَلِّغَهُ'),
        h('p', {}, '“May Allah brighten the face of one who hears a hadith from us, preserves it and passes it on.” Abu Dawud 3660')),
      h('div', { class: 'facts' },
        h('div', {}, h('b', {}, '4'), 'volumes'),
        h('div', {}, h('b', {}, '77'), 'books'),
        h('div', {}, h('b', {}, 'ML · AR'), 'Malayalam and Arabic'))),
    h('div', { class: 'card' }, form)));
  user.focus();
}

async function start() {
  try {
    const me = await api('me');
    session.csrf = me.csrf;
    session.user = me.user;
    session.pending = me.pending;
  } catch (e) {
    if (e.status === 401) return showLogin();
    app.replaceChildren(h('div', { class: 'login' }, h('div', { class: 'aside' }, h('div', { class: 'brand' }, mark(), h('b', {}, 'Hadees Vijnanakosham'))),
      h('div', { class: 'card' }, h('div', {}, h('h1', {}, 'The editor is not available'),
        h('p', { class: 'sub' }, e.message), h('button', { class: 'btn', style: 'margin-top:16px', onclick: start }, 'Retry')))));
    return;
  }
  shell = buildShell();
  lastHash = location.hash;
  route();
}

window.addEventListener('hv-logout', () => {
  if (shell) { toast('Your session ended. Please log in again.', 'err'); showLogin('Your session ended. Please log in again.'); }
});

start();
