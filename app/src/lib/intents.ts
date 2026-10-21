// Chat commands. Typed text is matched against these first; anything else goes to the active mode (search or AI).
export type Intent =
  | { kind: 'help' }
  | { kind: 'articles' }
  | { kind: 'books' }
  | { kind: 'search'; q: string; vol?: number }
  | { kind: 'hint'; text: string }
  | { kind: 'nav'; path: '/saved' | '/offline' | '/feedback' | '/settings' }
  | { kind: 'daily' }
  | { kind: 'random' }
  | { kind: 'narrator'; name: string }
  | { kind: 'jump'; term: string; no: number; q: string }
  | { kind: 'textsize'; delta: number }
  | { kind: 'ask' };

const short = (t: string, n: number) => t.split(/\s+/).length <= n;
const HELP = /^(help|menu|options|commands|what can you do\??|\?|സഹായം|മെനു)$/i;
const ARTICLES = /(intro|introduction|article|ആമുഖ|ലേഖന|അവതാരിക)/i;
const BOOKS = /^(books?|library|ഗ്രന്ഥ|പുസ്തക)/i;
const SEARCH = /^(search|find|തിരയുക|തിരയൂ|തിരയ)(\s+(.*))?$/i;
const VOL = /^vol(?:ume)?\s*(\d+)\s+(.*)$/i;

export function route(text: string): Intent {
  const t = text.trim();
  if (!t) return { kind: 'ask' };
  if (HELP.test(t)) return { kind: 'help' };
  if (/^(saved|bookmarks?|bookmark|സേവ്|ബുക്ക്മാർക്ക്)/i.test(t) && short(t, 2)) return { kind: 'nav', path: '/saved' };
  if (/^(offline|downloads?|ഓഫ്ലൈൻ|ഓഫ്‌ലൈൻ)/i.test(t) && short(t, 2)) return { kind: 'nav', path: '/offline' };
  if (/^(feedback|suggest|അഭിപ്രായം)/i.test(t) && short(t, 2)) return { kind: 'nav', path: '/feedback' };
  if (/^(settings?|ക്രമീകരണ)/i.test(t) && short(t, 2)) return { kind: 'nav', path: '/settings' };
  if (/^(bigger|larger|increase|big)\s+text$/i.test(t)) return { kind: 'textsize', delta: 2 };
  if (/^(smaller|decrease|small)\s+text$/i.test(t)) return { kind: 'textsize', delta: -2 };
  if (/^(daily|today|today'?s hadith|daily hadith|ഇന്ന്|ദിവസ|ദിനം)/i.test(t) && short(t, 3)) return { kind: 'daily' };
  if (/^(random|surprise|shuffle|ക്രമരഹിത|ഏതെങ്കിലും)/i.test(t) && short(t, 3)) return { kind: 'random' };
  const nm = t.match(/^(narrator|narrators|നിവേദക\S*)\s+(.+)$/i);
  if (nm) return { kind: 'narrator', name: nm[2].trim() };
  const sm = t.match(SEARCH);
  if (sm) {
    let q = (sm[3] ?? '').trim();
    let vol: number | undefined;
    const v = q.match(VOL);
    if (v) { vol = Number(v[1]); q = v[2].trim(); }
    return q ? { kind: 'search', q, vol } : { kind: 'hint', text: 'Type a word after "search", for example: search fasting or search vol 4 fasting' };
  }
  if (ARTICLES.test(t) && short(t, 4)) return { kind: 'articles' };
  if (BOOKS.test(t) && short(t, 3)) return { kind: 'books' };
  const jm = t.match(/^(?:hadith\s+|ഹദീസ്\s*)?(.+?)\s+(\d+)$/i);
  if (jm) return { kind: 'jump', term: jm[1].trim(), no: Number(jm[2]), q: t };
  return { kind: 'ask' };
}

// What the chat can do, shown by the "help" command. `q` is what gets sent when the chip is tapped.
export const FEATURES: { label: string; hint: string; q: string; icon: string }[] = [
  { label: 'Introduction & articles', hint: 'Read the book\'s introduction and prose articles', q: 'articles', icon: 'document-text-outline' },
  { label: 'Browse books', hint: 'Books, chapters and hadith', q: 'books', icon: 'library-outline' },
  { label: 'Search hadith', hint: 'Type "search" then a word; "search vol 4 <word>" limits to a volume', q: 'search ', icon: 'search-outline' },
  { label: 'Daily hadith', hint: 'Today\'s hadith', q: 'daily', icon: 'sunny-outline' },
  { label: 'Random hadith', hint: 'Open a random hadith', q: 'random', icon: 'shuffle-outline' },
  { label: 'Jump to hadith', hint: 'Type a book name and number, e.g. "bukhari 5"', q: 'hadith ', icon: 'navigate-outline' },
  { label: 'Narrator', hint: 'Type "narrator" then a name to see their hadith', q: 'narrator ', icon: 'person-outline' },
  { label: 'Text size', hint: '"bigger text" or "smaller text"', q: 'bigger text', icon: 'text-outline' },
  { label: 'Saved', hint: 'Bookmarks and notes', q: 'saved', icon: 'bookmark-outline' },
  { label: 'Offline books', hint: 'Download books to read without internet', q: 'offline', icon: 'cloud-download-outline' },
  { label: 'Feedback', hint: 'Send a suggestion or report a problem', q: 'feedback', icon: 'chatbubble-ellipses-outline' },
  { label: 'Settings', hint: 'Theme, text size, language', q: 'settings', icon: 'settings-outline' },
  { label: 'Ask a question', hint: 'AI answers with hadith references', q: 'What do the hadith say about fasting?', icon: 'sparkles-outline' },
];
