// Editor admin page: what the editor adds to ANY hadith (this encyclopedia, Sunnah.com, iHadis):
// translations (English / Urdu / Malayalam), corrected texts of the extra libraries, topics, and hide / grade switches.
// Stored in hadith_texts, hadith_topics, source_flags (api/editor-extras.sql), each change in History with Undo.
import { api, busy, confirmBox, h, icon, toast } from './core.js';

export const LANGS = {
  en: { name: 'English', cls: '', dir: 'ltr' },
  ur: { name: 'Urdu', cls: 'ur', dir: 'rtl' },
  ml: { name: 'Malayalam', cls: 'ml', dir: 'auto' },
  ar: { name: 'Arabic', cls: 'ar', dir: 'rtl' },
};

/** the admin page of any hadith key */
export function refHref(ref) {
  if (!ref) return '#/';
  if (ref.startsWith('h:')) return `#/h/${ref.slice(2)}`;
  if (ref.startsWith('s:')) return `#/src/h/${encodeURIComponent(ref.slice(2))}`;
  if (ref.startsWith('i:')) return `#/src/ih/${ref.slice(2).split('/').map(encodeURIComponent).join('/')}`;
  return '#/';
}

/** a textarea that grows with its text (no inner scrollbar while editing long hadith) */
export function autoGrow(el, max = 900) {
  const fit = () => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(max, el.scrollHeight + 2)}px`;
  };
  el.addEventListener('input', fit);
  requestAnimationFrame(fit);
  return el;
}

let topicCache = null;
const allTopics = (fresh = false) => {
  if (fresh || !topicCache) topicCache = api('topics').catch((e) => { topicCache = null; throw e; });
  return topicCache;
};
export const forgetTopics = () => { topicCache = null; };

/**
 * opts: {
 *   ref,              hadith key
 *   data,             extras_of() from the API: { texts: [{row, ver}], topics: [...], flag }
 *   langs,            e.g. ['en', 'ur'] or ['ml', 'ur', 'en', 'ar']
 *   originals,        { en: 'imported English', ar: '...' } -> that language is a CORRECTION of the imported text
 *   flags,            true for the extra libraries: "hide" + corrected grade
 *   originalGrade,
 * }
 * Returns { el, isDirty }.
 */
export function extrasPanel(opts) {
  const dirty = new Set();
  const reload = async () => {
    const d = await api('extras', { ref: opts.ref });
    opts.data = d;
    body.replaceChildren(...sections());
  };
  const sections = () => [
    ...opts.langs.map((lang) => textCard(lang)),
    topicsCard(),
    opts.flags ? flagCard() : null,
  ].filter(Boolean);

  // ── one language: add / edit / remove ──
  function textCard(lang) {
    const L = LANGS[lang];
    const correction = opts.originals && lang in opts.originals;
    const title = correction ? `Corrected ${L.name} text` : `${L.name} translation`;
    const found = opts.data.texts.find((t) => t.row.lang === lang);
    const card = h('section', { class: 'xcard' });
    const key = `t-${lang}`;

    const closed = () => {
      dirty.delete(key);
      card.replaceChildren(
        h('div', { class: 'xhead' }, h('span', { class: `lang-chip lc-${lang}` }, lang.toUpperCase()), h('h3', {}, title),
          h('span', { class: 'spacer' }), h('span', { class: 'small muted' }, correction ? 'Shown instead of the imported text' : 'Optional')),
        h('button', { class: 'btn dashed', type: 'button', onclick: () => open(null) }, icon('plus'), correction ? `Correct the ${L.name} text` : `Add ${L.name} translation`));
    };

    const open = (item) => {
      const row = item?.row || {};
      let ver = item?.ver || '';
      const start = row.body ?? (correction ? opts.originals[lang] || '' : '');
      const bodyEl = autoGrow(h('textarea', { class: L.cls, dir: L.dir, lang, rows: 3, value: start, 'aria-label': title }));
      const narr = h('input', { type: 'text', class: L.cls, dir: L.dir, value: row.narrator ?? '', placeholder: 'Narrator (optional)', 'aria-label': `Narrator in ${L.name}` });
      const note = h('input', { type: 'text', value: row.note ?? '', placeholder: correction ? 'Why it was corrected (optional)' : 'Translated by / source (optional)', 'aria-label': 'Note' });
      const saveBtn = h('button', { class: 'btn primary', type: 'submit' }, item ? 'Save' : 'Add');
      const state = h('span', { class: 'small muted' });
      const isChanged = () => bodyEl.value !== (row.body ?? start) || narr.value !== (row.narrator ?? '') || note.value !== (row.note ?? '') || !item;
      const refresh = () => {
        const c = item ? isChanged() : bodyEl.value.trim() !== '';
        if (c) dirty.add(key); else dirty.delete(key);
        saveBtn.disabled = !c;
        state.textContent = item ? (c ? 'Unsaved changes' : `Saved ${new Date(row.updated_at).toLocaleDateString()}`) : '';
      };
      [bodyEl, narr, note].forEach((x) => x.addEventListener('input', refresh));

      const remove = h('button', { class: 'btn danger', type: 'button' }, icon('trash'), item ? 'Remove' : 'Cancel');
      remove.addEventListener('click', async () => {
        if (!item) { closed(); return; }
        if (!(await confirmBox({ title: `Remove the ${title.toLowerCase()}?`, danger: true, ok: 'Remove', text: 'It stays in History, where Undo brings it back.' }))) return;
        busy(remove, async () => { await api('delete', {}, { tbl: 'hadith_texts', id: row.id, ver }); toast('Removed.'); dirty.delete(key); await reload(); });
      });
      const form = h('form', { novalidate: true, onsubmit: (e) => {
        e.preventDefault();
        busy(saveBtn, async () => {
          if (!bodyEl.value.trim()) throw new Error('The text is empty. Use Remove to delete it.');
          const fields = { body: bodyEl.value, narrator: narr.value, note: note.value };
          if (item) {
            const res = await api('save', {}, { tbl: 'hadith_texts', id: row.id, ver, fields });
            ver = res.ver;
          } else {
            await api('create', {}, { tbl: 'hadith_texts', fields: { ...fields, ref: opts.ref, lang } });
          }
          toast('Saved.');
          dirty.delete(key);
          await reload();
        });
      } },
      bodyEl,
      h('div', { class: 'grid2 tight' }, narr, note),
      h('div', { class: 'row' }, saveBtn, state, h('span', { class: 'spacer' }),
        correction && item ? h('button', { class: 'btn ghost', type: 'button', onclick: () => { bodyEl.value = opts.originals[lang] || ''; bodyEl.dispatchEvent(new Event('input')); } }, 'Start again from the imported text') : null,
        remove));
      card.replaceChildren(
        h('div', { class: 'xhead' }, h('span', { class: `lang-chip lc-${lang}` }, lang.toUpperCase()), h('h3', {}, title), h('span', { class: 'spacer' }),
          item ? h('span', { class: 'pill ok' }, correction ? 'Corrected' : 'Added') : h('span', { class: 'pill' }, 'New')),
        form);
      refresh();
      if (!item) bodyEl.focus();
    };

    if (found) open(found); else closed();
    return card;
  }

  // ── topics: chips + add (pick an existing topic or create one) ──
  function topicsCard() {
    const list = opts.data.topics;
    const input = h('input', { type: 'text', placeholder: 'Type a topic, e.g. Prayer / നമസ്കാരം', 'aria-label': 'Add a topic', autocomplete: 'off' });
    const sugg = h('div', { class: 'suggest', hidden: true, role: 'listbox' });
    const addBtn = h('button', { class: 'btn', type: 'submit' }, icon('plus'), 'Add');
    const link = async (topicId) => {
      await api('create', {}, { tbl: 'hadith_topics', fields: { ref: opts.ref, topic_id: topicId } });
      toast('Topic added.');
      forgetTopics();
      await reload();
    };
    const match = (t, s) => [t.name_en, t.name_ml, t.name_ur].some((x) => x && x.toLowerCase() === s);
    const showSugg = async () => {
      const s = input.value.trim().toLowerCase();
      if (!s) { sugg.hidden = true; return; }
      let all = [];
      try { all = await allTopics(); } catch { return; }
      const have = new Set(list.map((t) => t.topic_id));
      const hits = all.filter((t) => !have.has(t.id) && [t.name_en, t.name_ml, t.name_ur].some((x) => x && x.toLowerCase().includes(s))).slice(0, 8);
      sugg.replaceChildren(...hits.map((t) => h('button', { type: 'button', class: 'opt', role: 'option', onclick: () => busy(addBtn, () => link(t.id)) },
        h('b', {}, t.name_en), t.name_ml ? h('span', { class: 'ml' }, t.name_ml) : null, h('span', { class: 'small muted' }, `${t.hadiths} hadith`))));
      sugg.hidden = !hits.length;
    };
    input.addEventListener('input', showSugg);
    input.addEventListener('blur', () => setTimeout(() => { sugg.hidden = true; }, 150));
    const form = h('form', { class: 'topic-add', novalidate: true, onsubmit: (e) => {
      e.preventDefault();
      busy(addBtn, async () => {
        const name = input.value.trim();
        if (!name) throw new Error('Type a topic name first.');
        const all = await allTopics(true);
        const hit = all.find((t) => match(t, name.toLowerCase()));
        if (hit) { await link(hit.id); return; }
        if (!(await confirmBox({ title: `Create the topic “${name}”?`, ok: 'Create and add', text: 'It is a new topic. You can add its Malayalam and Urdu names later under Topics.' }))) return;
        const res = await api('create', {}, { tbl: 'topics', fields: { name_en: name } });
        await link(res.id);
      });
    } }, h('div', { class: 'grow rel' }, input, sugg), addBtn);
    return h('section', { class: 'xcard' },
      h('div', { class: 'xhead' }, icon('tag'), h('h3', {}, 'Topics'), h('span', { class: 'spacer' }), h('a', { class: 'small', href: '#/topics' }, 'All topics')),
      list.length ? h('div', { class: 'chips' }, list.map((t) => {
        const x = h('button', { class: 'chip-x', type: 'button', 'aria-label': `Remove topic ${t.name_en}`, title: 'Remove' }, '×');
        x.addEventListener('click', () => busy(x, async () => {
          await api('delete', {}, { tbl: 'hadith_topics', id: t.id, ver: '' });
          toast('Topic removed.');
          forgetTopics();
          await reload();
        }));
        return h('span', { class: 'chip' }, h('a', { href: `#/t/${t.topic_id}` }, t.name_en, t.name_ml ? h('span', { class: 'ml' }, ` · ${t.name_ml}`) : null), x);
      })) : h('p', { class: 'small muted', style: 'margin:0 0 10px' }, 'No topics yet.'),
      form);
  }

  // ── extra libraries: hide from readers + AI, corrected grade ──
  function flagCard() {
    const f = opts.data.flag;
    const row = f?.row || { hidden: false, grade: '', note: '' };
    const hidden = h('input', { type: 'checkbox', checked: !!row.hidden });
    const grade = h('input', { type: 'text', value: row.grade ?? '', placeholder: opts.originalGrade ? `Imported: ${opts.originalGrade}` : 'e.g. Sahih / Hasan / Da‘if', 'aria-label': 'Corrected grade' });
    const note = h('input', { type: 'text', value: row.note ?? '', placeholder: 'Why (optional)', 'aria-label': 'Note' });
    const btn = h('button', { class: 'btn primary', type: 'submit', disabled: true }, 'Save');
    const changed = () => hidden.checked !== !!row.hidden || grade.value !== (row.grade ?? '') || note.value !== (row.note ?? '');
    const refresh = () => { btn.disabled = !changed(); if (changed()) dirty.add('flag'); else dirty.delete('flag'); };
    [hidden, grade, note].forEach((x) => { x.addEventListener('input', refresh); x.addEventListener('change', refresh); });
    return h('section', { class: `xcard${row.hidden ? ' is-hidden' : ''}` },
      h('div', { class: 'xhead' }, icon('eye'), h('h3', {}, 'Visibility and grade'), h('span', { class: 'spacer' }),
        row.hidden ? h('span', { class: 'pill bad' }, 'Hidden') : h('span', { class: 'pill' }, 'Shown')),
      h('form', { novalidate: true, onsubmit: (e) => {
        e.preventDefault();
        busy(btn, async () => {
          const fields = { hidden: hidden.checked, grade: grade.value, note: note.value };
          if (f) await api('save', {}, { tbl: 'source_flags', id: row.id, ver: f.ver, fields });
          else await api('create', {}, { tbl: 'source_flags', fields: { ...fields, ref: opts.ref } });
          toast('Saved.');
          dirty.delete('flag');
          await reload();
        });
      } },
      h('label', { class: 'check' }, hidden, 'Hide this hadith from readers and from the AI answers'),
      h('div', { class: 'grid2 tight', style: 'margin-top:12px' }, grade, note),
      h('div', { class: 'row' }, btn)));
  }

  const body = h('div', { class: 'xbody' }, ...sections());
  const el = h('div', { class: 'panel extras' },
    h('div', { class: 'ph' }, icon('languages'), h('h2', {}, 'Translations and topics'), h('span', { class: 'meta' }, 'Each part saves on its own and is kept in History.')),
    body);
  return { el, isDirty: () => dirty.size > 0 };
}
