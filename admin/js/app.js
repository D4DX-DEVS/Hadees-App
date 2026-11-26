// Editor admin page: login, the shell (tinted frame + white sheet), routing (#/...), unsaved-change guard.
import { api, busy, confirmBox, h, icon, mark, onPending, session, toast } from './core.js';
import { hadithView, newHadithView } from './hadith.js';
import { bookHadithsView, bookView, chapterView, pendingView, reviewView, searchView, volumeView } from './views.js';
import { homeView } from './dashboard.js';
import { installSelects } from './select.js';
import { articleView, articlesView, editView, historyView, narratorView, narratorsView } from './views2.js';
import { collectionView, ihBookView, ihChapterView, ihHadithView, sourceFindView, sourcesView, srcBookView, srcHadithView, topicView, topicsView } from './sources.js';

const dec = decodeURIComponent;

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
  [/^#?\/?$/, (m, root) => homeView(root), 'library', 'Dashboard'],
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
  [/^#\/src$/, (m, root, p) => sourcesView(root, p), 'sources', 'Sources'],
  [/^#\/src\/find$/, (m, root, p) => sourceFindView(root, p), 'sources', 'Search sources'],
  [/^#\/src\/c\/([^/]+)$/, (m, root) => collectionView(root, dec(m[1])), 'sources', 'Collection'],
  [/^#\/src\/c\/([^/]+)\/([^/]+)$/, (m, root) => srcBookView(root, dec(m[1]), dec(m[2])), 'sources', 'Book'],
  [/^#\/src\/h\/([^/]+)$/, (m, root) => srcHadithView(root, dec(m[1])), 'sources', 'Hadith'],
  [/^#\/src\/i\/([^/]+)$/, (m, root, p) => ihBookView(root, dec(m[1]), p), 'sources', 'Book'],
  [/^#\/src\/i\/([^/]+)\/(\d+)$/, (m, root, p) => ihChapterView(root, dec(m[1]), m[2], p), 'sources', 'Chapter'],
  [/^#\/src\/ih\/([^/]+)\/([^/]+)$/, (m, root) => ihHadithView(root, dec(m[1]), dec(m[2])), 'sources', 'Hadith'],
  [/^#\/topics$/, (m, root) => topicsView(root), 'topics', 'Topics'],
  [/^#\/t\/(\d+)$/, (m, root) => topicView(root, m[1]), 'topics', 'Topic'],
];

/** [key, href, label, icon] in groups */
const NAV = [
  [null, [['library', '#/', 'Dashboard', 'home'], ['review', '#/review', 'Needs review', 'flag'], ['search', '#/search', 'Search', 'search']]],
  ['Encyclopedia', [['articles', '#/articles', 'Articles', 'article'], ['narrators', '#/narrators', 'Narrators', 'users']]],
  ['Libraries', [['sources', '#/src', 'Sunnah.com · iHadis', 'globe'], ['topics', '#/topics', 'Topics', 'tag']]],
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
    const ok = await confirmBox(hasUnsaved()
      ? { title: 'Log out?', text: 'This page has changes that are not saved yet. They will be lost.', ok: 'Log out', danger: true, kind: 'logout' }
      : { title: 'Log out?', text: 'You will need the username and password to come back in.', ok: 'Log out', kind: 'logout' });
    if (!ok) return;
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
  const themeBtn = h('button', { class: 'btn ghost icon', type: 'button' });
  const drawTheme = () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    themeBtn.replaceChildren(icon(dark ? 'sun' : 'moon'));
    themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    themeBtn.title = dark ? 'Light mode' : 'Dark mode';
  };
  themeBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('hv-theme', next); } catch { /* not remembered */ }
    drawTheme();
  });
  drawTheme();
  const root = h('div', { class: 'shell' },
    h('aside', { class: 'side', 'aria-label': 'Navigation' },
      h('a', { class: 'brand', href: '#/' }, mark(), h('div', {}, h('b', {}, 'Hadees Vijnanakosham'), h('small', {}, 'Editor'))),
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
      h('div', { class: 'right' }, status, themeBtn,
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
    const ok = await confirmBox({ title: 'Leave without saving?', text: 'This page has changes that are not saved yet. They will be lost.', ok: 'Leave', danger: true, kind: 'leave' });
    leaving = false;
    if (!ok) return;
    leaveGuard = null;
    history.replaceState(null, '', target);
  }
  lastHash = location.hash;
  route();
});

// ───────── login: a green brand panel (pattern, the hadith on conveying hadith), the form on the right ─────────
/** the brand half of the login screen (also used by "the editor is not available") */
function loginAside() {
  return h('div', { class: 'aside' },
    h('div', { class: 'brand' }, mark(), h('div', {}, h('b', {}, 'Hadees Vijnanakosham'), h('small', {}, 'ഹദീസ് വിജ്ഞാനകോശം'))),
    h('figure', { class: 'quote' },
      h('p', { class: 'ar', lang: 'ar', dir: 'rtl' }, 'نَضَّرَ اللَّهُ امْرَأً سَمِعَ مِنَّا حَدِيثًا فَحَفِظَهُ حَتَّى يُبَلِّغَهُ'),
      h('figcaption', {}, '“May Allah brighten the face of one who hears a hadith from us, preserves it and passes it on.”', h('span', {}, 'Abu Dawud 3660'))),
    h('ul', { class: 'facts' },
      h('li', {}, h('b', {}, '4'), 'volumes'),
      h('li', {}, h('b', {}, '77'), 'books'),
      h('li', {}, h('b', {}, '2'), 'hadith libraries')));
}

/** light / dark switch for screens without the top bar */
function themeSwitch() {
  const btn = h('button', { class: 'btn ghost icon theme-switch', type: 'button' });
  const draw = () => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.replaceChildren(icon(dark ? 'sun' : 'moon'));
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    btn.title = dark ? 'Light mode' : 'Dark mode';
  };
  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('hv-theme', next); } catch { /* not remembered */ }
    draw();
  });
  draw();
  return btn;
}

function showLogin(message = '') {
  shell = null;
  const user = h('input', { id: 'lu', type: 'text', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true, placeholder: 'Your username' });
  const pass = h('input', { id: 'lp', type: 'password', autocomplete: 'current-password', required: true, placeholder: 'Your password' });
  const eye = h('button', { type: 'button', class: 'pw-eye', 'aria-label': 'Show password', 'aria-pressed': 'false', 'aria-controls': 'lp', title: 'Show password' }, icon('eye'));
  eye.addEventListener('click', () => {
    const show = pass.type === 'password';
    pass.type = show ? 'text' : 'password';
    eye.replaceChildren(icon(show ? 'eye-off' : 'eye'));
    eye.setAttribute('aria-pressed', show ? 'true' : 'false');
    eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    eye.title = show ? 'Hide password' : 'Show password';
    pass.focus();
  });
  // the password goes back to hidden before it is sent (a browser that saves it, or a screenshot, never shows it)
  const hidePass = () => { if (pass.type === 'text') eye.click(); };
  const caps = h('p', { class: 'caps', hidden: true }, icon('alert'), 'Caps Lock is on');
  const capsCheck = (e) => { if (e.getModifierState) caps.hidden = !e.getModifierState('CapsLock'); };
  pass.addEventListener('keydown', capsCheck);
  pass.addEventListener('keyup', capsCheck);
  pass.addEventListener('blur', () => { caps.hidden = true; });

  const errText = h('span', {});
  const err = h('div', { class: 'login-err', role: 'alert', hidden: !message }, icon('alert'), errText);
  const showErr = (t) => { errText.textContent = t; err.hidden = !t; };
  showErr(message);
  [user, pass].forEach((x) => x.addEventListener('input', () => { if (!err.hidden) showErr(''); }));
  const btn = h('button', { class: 'btn primary login-btn', type: 'submit' }, h('span', {}, 'Log in'), icon('right'));
  const form = h('form', { novalidate: true, onsubmit: (e) => {
    e.preventDefault();
    showErr('');
    if (!user.value.trim() || !pass.value) {
      showErr('Enter your username and password.');
      (user.value.trim() ? pass : user).focus();
      return;
    }
    hidePass();
    busy(btn, async () => {
      try {
        const r = await api('login', {}, { user: user.value, pass: pass.value });
        session.csrf = r.csrf;
        session.user = r.user;
        start();
      } catch (e2) {
        showErr(e2.status === 0 ? 'Could not reach the server. Check the connection and try again.' : e2.message);
        pass.value = '';
        pass.focus();
      }
    });
  } },
  h('div', { class: 'login-mark' }, mark()),
  h('h1', {}, 'Welcome back'),
  h('p', { class: 'sub' }, 'Log in to edit the encyclopedia. Your corrections go live on the website and in the app.'),
  err,
  h('div', { class: 'field' }, h('label', { for: 'lu' }, 'Username'),
    h('div', { class: 'in-icon' }, icon('user'), user)),
  h('div', { class: 'field' }, h('label', { for: 'lp' }, 'Password'),
    h('div', { class: 'in-icon pw' }, icon('lock'), pass, eye), caps),
  btn,
  h('div', { class: 'login-foot' },
    h('span', {}, icon('history'), 'Every change is kept in History and can be undone.'),
    h('a', { href: '/' }, 'Back to the website')));

  app.replaceChildren(h('div', { class: 'login' }, loginAside(), h('div', { class: 'card' }, form), themeSwitch()));
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
    app.replaceChildren(h('div', { class: 'login' }, loginAside(),
      h('div', { class: 'card' }, h('form', { onsubmit: (ev) => { ev.preventDefault(); start(); } },
        h('div', { class: 'login-mark' }, mark()),
        h('h1', {}, 'The editor is not available'),
        h('div', { class: 'login-err', role: 'alert' }, icon('alert'), h('span', {}, e.message)),
        h('button', { class: 'btn primary login-btn', type: 'submit' }, h('span', {}, 'Try again'), icon('right')))), themeSwitch()));
    return;
  }
  shell = buildShell();
  lastHash = location.hash;
  route();
}

window.addEventListener('hv-logout', () => {
  if (shell) { toast('Your session ended. Please log in again.', 'err'); showLogin('Your session ended. Please log in again.'); }
});

installSelects();
start();
