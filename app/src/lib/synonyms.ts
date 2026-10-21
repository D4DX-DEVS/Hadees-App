/**
 * English / transliterated words -> Malayalam words used in the book, so "fasting" or "Abu Hurairah" finds hadith.
 * Every Malayalam word here was checked against the database (it matches at least one hadith).
 * `text` words are searched in the hadith text and chapter titles; `narrators` only in the narrator's name.
 */
type Entry = { en: string[]; text?: string[]; narrators?: string[] };

const TOPICS: Entry[] = [
  { en: ['fasting', 'fast', 'sawm', 'siyam', 'roza', 'roja'], text: ['നോമ്പ്', 'വ്രത'] },
  { en: ['ramadan', 'ramzan', 'ramadhan'], text: ['റമളാൻ', 'റമദാൻ', 'നോമ്പ്'] },
  { en: ['prayer', 'salah', 'salat', 'namaz', 'nimaz'], text: ['നിസ്കാര', 'നമസ്കാര'] },
  { en: ['dua', 'supplication', 'prayer request'], text: ['ദുആ', 'പ്രാർത്ഥന'] },
  { en: ['dhikr', 'zikr', 'remembrance'], text: ['ദിക്ർ'] },
  { en: ['zakat', 'zakah'], text: ['സകാത്ത്', 'സക്കാത്ത്'] },
  { en: ['charity', 'sadaqah', 'sadaqa', 'alms'], text: ['ദാനം', 'സ്വദഖ'] },
  { en: ['hajj', 'pilgrimage', 'haj'], text: ['ഹജ്ജ്'] },
  { en: ['umrah', 'umra'], text: ['ഉംറ'] },
  { en: ['ihram'], text: ['ഇഹ്റാം'] },
  { en: ['tawaf'], text: ['ത്വവാഫ്'] },
  { en: ['arafah', 'arafat'], text: ['അറഫ'] },
  { en: ['eid', 'id'], text: ['പെരുന്നാൾ'] },
  { en: ['sacrifice', 'qurbani', 'udhiyah'], text: ['ബലി'] },
  { en: ['wudu', 'ablution', 'wuzu'], text: ['വുദൂ', 'വുളൂ'] },
  { en: ['ghusl', 'bath', 'bathing'], text: ['കുളി'] },
  { en: ['tayammum'], text: ['തയമ്മും'] },
  { en: ['janabah', 'janaba'], text: ['ജനാബത്ത്'] },
  { en: ['adhan', 'azan', 'athan'], text: ['ബാങ്ക്'] },
  { en: ['iqamah', 'iqama'], text: ['ഇഖാമത്ത്'] },
  { en: ['mosque', 'masjid'], text: ['പള്ളി'] },
  { en: ['friday', 'jumuah', 'jumah', 'juma'], text: ['ജുമുഅ'] },
  { en: ['khutbah', 'sermon', 'khutba'], text: ['ഖുതുബ'] },
  { en: ['sujud', 'prostration'], text: ['സുജൂദ്'] },
  { en: ['ruku', 'bowing'], text: ['റുകൂഅ്'] },
  { en: ['witr'], text: ['വിത്ർ'] },
  { en: ['taraweeh', 'tarawih'], text: ['തറാവീഹ്'] },
  { en: ['itikaf', 'seclusion'], text: ['ഇഅ്തികാഫ്'] },
  { en: ['laylat al qadr', 'laylatul qadr', 'night of decree', 'lailatul qadr'], text: ['ലൈലത്തുൽ ഖദ്ർ'] },
  { en: ['suhoor', 'sehri', 'pre dawn meal'], text: ['അത്താഴ'] },
  { en: ['new moon', 'moon sighting', 'crescent'], text: ['മാസപ്പിറവി', 'ചന്ദ്ര'] },
  { en: ['marriage', 'nikah', 'wedding'], text: ['വിവാഹ'] },
  { en: ['divorce', 'talaq'], text: ['വിവാഹമോചന', 'ത്വലാഖ്'] },
  { en: ['wife', 'wives'], text: ['ഭാര്യ'] },
  { en: ['husband'], text: ['ഭർത്താവ്'] },
  { en: ['woman', 'women'], text: ['സ്ത്രീ'] },
  { en: ['child', 'children', 'kids'], text: ['കുട്ടി'] },
  { en: ['orphan', 'orphans'], text: ['അനാഥ'] },
  { en: ['adoption'], text: ['ദത്ത്'] },
  { en: ['parents', 'mother', 'father'], text: ['മാതാപിതാക്ക'] },
  { en: ['neighbour', 'neighbor', 'neighbours'], text: ['അയൽ'] },
  { en: ['trade', 'business', 'commerce', 'selling'], text: ['കച്ചവട', 'വ്യാപാര'] },
  { en: ['interest', 'riba', 'usury'], text: ['പലിശ'] },
  { en: ['loan', 'debt', 'borrowing'], text: ['കടം', 'വായ്പ'] },
  { en: ['inheritance', 'heirs'], text: ['അനന്തരാവകാശ'] },
  { en: ['will', 'bequest', 'wasiyyah'], text: ['വസ്വിയ്യത്ത്'] },
  { en: ['land', 'earth'], text: ['ഭൂമി'] },
  { en: ['farming', 'agriculture', 'crops'], text: ['കൃഷി'] },
  { en: ['patience', 'sabr'], text: ['ക്ഷമ'] },
  { en: ['quran', 'koran', 'quraan'], text: ['ഖുർആൻ'] },
  { en: ['death', 'dying'], text: ['മരണ'] },
  { en: ['funeral', 'janazah', 'janaza'], text: ['ജനാസ'] },
  { en: ['grave', 'qabr'], text: ['ഖബ്ർ'] },
  { en: ['jihad'], text: ['ജിഹാദ്', 'യുദ്ധ'] },
  { en: ['war', 'battle'], text: ['യുദ്ധ'] },
  { en: ['hijra', 'hijrah', 'migration'], text: ['ഹിജ്റ'] },
  { en: ['treaty', 'peace'], text: ['സന്ധി'] },
  { en: ['spoils', 'ghanimah', 'booty'], text: ['ഗനീമത്ത്'] },
  { en: ['alcohol', 'wine', 'intoxicant', 'intoxicants', 'khamr'], text: ['മദ്യ', 'കള്ള്'] },
  { en: ['lie', 'lying', 'lies'], text: ['കളവ്'] },
  { en: ['theft', 'thief', 'stealing'], text: ['മോഷ്ടാ'] },
  { en: ['oath', 'swear', 'swearing', 'vow'], text: ['സത്യം', 'ശപഥ'] },
  { en: ['faith', 'belief', 'iman', 'eman'], text: ['ഈമാൻ', 'വിശ്വാസം'] },
  { en: ['shirk', 'polytheism'], text: ['ശിർക്ക്'] },
  { en: ['paradise', 'heaven', 'jannah', 'jannat'], text: ['സ്വർഗ'] },
  { en: ['hell', 'hellfire', 'jahannam', 'fire'], text: ['നരക'] },
  { en: ['judgment day', 'last day', 'qiyamah', 'qiyama', 'day of resurrection'], text: ['അന്ത്യദിന', 'ഖിയാമത്'] },
  { en: ['angel', 'angels', 'malak'], text: ['മലക്ക്'] },
  { en: ['satan', 'devil', 'shaytan', 'shaitan'], text: ['പിശാച്', 'ശൈത്വാൻ'] },
  { en: ['dajjal', 'antichrist'], text: ['ദജ്ജാൽ'] },
  { en: ['sunnah', 'sunna'], text: ['സുന്നത്ത്'] },
  { en: ['knowledge', 'learning', 'ilm'], text: ['വിജ്ഞാന'] },
  { en: ['slave', 'slaves', 'slavery'], text: ['അടിമ'] },
  { en: ['sin', 'sins'], text: ['പാപ'] },
  { en: ['repentance', 'tawbah', 'tawba'], text: ['തൗബ', 'പശ്ചാത്താപ'] },
  { en: ['forgiveness', 'istighfar'], text: ['ഇസ്തിഗ്ഫാർ'] },
  { en: ['anger'], text: ['കോപ'] },
  { en: ['envy', 'jealousy'], text: ['അസൂയ'] },
  { en: ['backbiting', 'gossip'], text: ['പരദൂഷണ'] },
  { en: ['medicine', 'treatment', 'cure', 'healing'], text: ['ചികിത്സ'] },
  { en: ['sick', 'sickness', 'illness', 'disease'], text: ['രോഗ'] },
  { en: ['greeting', 'salam', 'salaam'], text: ['സലാം'] },
  { en: ['food', 'eating', 'meal'], text: ['ഭക്ഷണ'] },
  { en: ['water'], text: ['വെള്ളം'] },
  { en: ['drink', 'drinking'], text: ['പാനീയ'] },
  { en: ['clothes', 'clothing', 'dress'], text: ['വസ്ത്ര'] },
  { en: ['gold'], text: ['സ്വർണ'] },
  { en: ['silk'], text: ['പട്ട്'] },
  { en: ['pictures', 'images', 'statues'], text: ['ചിത്ര'] },
  { en: ['music', 'singing'], text: ['സംഗീത'] },
  { en: ['witness', 'witnesses', 'testimony'], text: ['സാക്ഷി'] },
  { en: ['punishment', 'torment'], text: ['ശിക്ഷ'] },
  { en: ['hudud', 'hadd'], text: ['ഹദ്ദ്'] },
  { en: ['murder', 'killing', 'kill'], text: ['കൊല'] },
  { en: ['dream', 'dreams'], text: ['സ്വപ്ന'] },
  { en: ['ruler', 'leader', 'caliph', 'governor'], text: ['ഭരണാധികാരി'] },
  { en: ['blessing', 'blessings', 'favour'], text: ['അനുഗ്രഹ'] },
  { en: ['good deeds', 'reward'], text: ['പുണ്യ'] },
];

const NARRATORS: Entry[] = [
  { en: ['abu hurairah', 'abu huraira', 'abu hurayra', 'abu hureira'], narrators: ['അബൂഹുറൈറ', 'അബുഹുറൈറ'] },
  { en: ['aisha', 'aishah', 'ayesha', 'ayisha', 'a isha'], narrators: ['ആഇശ', 'ആയിശ'] },
  { en: ['ibn abbas', 'abdullah ibn abbas', 'ibn abbaas'], narrators: ['ഇബ്നുഅബ്ബാസ്', 'അബ്ദുല്ലാഹിബ്നുഅബ്ബാസ്'] },
  { en: ['ibn umar', 'abdullah ibn umar', 'ibn omar'], narrators: ['ഇബ്നുഉമർ', 'അബ്ദുല്ലാഹിബ്നുഉമർ'] },
  { en: ['ibn masud', 'ibn mas ud', 'abdullah ibn masud'], narrators: ['ഇബ്നുമസ്ഊദ്', 'അബ്ദുല്ലാഹിബ്നുമസ്ഊദ്'] },
  { en: ['abdullah ibn amr', 'ibn amr'], narrators: ['അബ്ദുല്ലാഹിബ്നുഅംറ്'] },
  { en: ['anas', 'anas ibn malik'], narrators: ['അനസ്'] },
  { en: ['jabir', 'jabir ibn abdullah'], narrators: ['ജാബിർ'] },
  { en: ['ali', 'ali ibn abi talib'], narrators: ['അലി'] },
  { en: ['umar', 'omar', 'umar ibn al khattab'], narrators: ['ഉമർ'] },
  { en: ['uthman', 'usman', 'othman'], narrators: ['ഉസ്മാൻ'] },
  { en: ['abu bakr', 'abu bakar'], narrators: ['അബൂബക്'] },
  { en: ['umm salamah', 'umm salama', 'ummu salama'], narrators: ['ഉമ്മുസലമ'] },
  { en: ['abu said', 'abu said al khudri', 'abu saeed'], narrators: ['അബൂസഈദ്'] },
  { en: ['abu dharr', 'abu zar', 'abu dhar'], narrators: ['അബൂദർ'] },
  { en: ['abu musa', 'abu musa al ashari'], narrators: ['അബൂമൂസ'] },
  { en: ['abu qatadah', 'abu qatada'], narrators: ['അബൂഖതാദ'] },
  { en: ['abu umamah', 'abu umama'], narrators: ['അബൂഉമാമ'] },
  { en: ['abu darda', 'abu ad darda'], narrators: ['ദർദാ'] },
  { en: ['abu ayyub', 'abu ayub'], narrators: ['അബൂഅയ്യൂബ്'] },
  { en: ['abu rafi', 'abu rafi'], narrators: ['അബൂറാഫി'] },
  { en: ['buraidah', 'buraida'], narrators: ['ബുറൈദ'] },
  { en: ['al bara', 'bara', 'bara ibn azib'], narrators: ['ബറാഅ്', 'ബറാഉ'] },
  { en: ['hudhaifah', 'hudhaifa', 'huzaifa'], narrators: ['ഹുദൈഫ'] },
  { en: ['uqbah ibn amir', 'uqba'], narrators: ['ഉഖ്ബത'] },
  { en: ['rafi ibn khadij', 'rafi'], narrators: ['റാഫിഅ്'] },
  { en: ['ubadah ibn as samit', 'ubadah', 'ubada'], narrators: ['ഉബാദത'] },
  { en: ['imran ibn husain', 'imran'], narrators: ['ഇംറാൻ'] },
  { en: ['muawiyah', 'muawiya', 'mu awiyah'], narrators: ['മുആവിയ'] },
  { en: ['muadh ibn jabal', 'muadh', 'mu adh'], narrators: ['മുആദ്'] },
  { en: ['zaid ibn arqam', 'zaid ibn thabit', 'zayd'], narrators: ['സൈദ്'] },
  { en: ['samurah', 'samura'], narrators: ['സമുറ'] },
  { en: ['sahl ibn sad', 'sahl'], narrators: ['സഹ്ൽ'] },
  { en: ['usamah ibn zaid', 'usama'], narrators: ['ഉസാമ'] },
  { en: ['sad ibn abi waqqas', 'sa d', 'saad'], narrators: ['സഅ്ദ്'] },
  { en: ['zubair', 'zubayr', 'abdullah ibn zubair'], narrators: ['സുബൈർ'] },
  { en: ['talhah', 'talha'], narrators: ['ത്വൽഹ'] },
  { en: ['salman', 'salman al farisi'], narrators: ['സൽമാൻ'] },
  { en: ['bilal'], narrators: ['ബിലാൽ'] },
  { en: ['khalid', 'khalid ibn al walid'], narrators: ['ഖാലിദ്'] },
  { en: ['hasan', 'al hasan'], narrators: ['ഹസൻ'] },
  { en: ['husain', 'hussain', 'husayn'], narrators: ['ഹുസൈൻ'] },
  { en: ['fatimah', 'fatima'], narrators: ['ഫാത്വിമ'] },
  { en: ['khadijah', 'khadija'], narrators: ['ഖദീജ'] },
  { en: ['maymunah', 'maimuna', 'maymuna'], narrators: ['മൈമൂന'] },
  { en: ['hafsah', 'hafsa'], narrators: ['ഹഫ്സ'] },
  { en: ['zainab', 'zaynab'], narrators: ['സൈനബ്'] },
  { en: ['asma', 'asma bint abu bakr'], narrators: ['അസ്മാഅ്'] },
  { en: ['umm habibah', 'umm habiba'], narrators: ['ഉമ്മുഹബീബ'] },
  { en: ['umm hani', 'umm hani'], narrators: ['ഉമ്മുഹാനി'] },
  { en: ['jarir', 'jarir ibn abdullah'], narrators: ['ജരീർ'] },
  { en: ['abbas', 'al abbas'], narrators: ['അബ്ബാസ്'] },
  { en: ['mughirah', 'mughira', 'al mughirah ibn shubah'], narrators: ['മുഗീറ'] },
  { en: ['kab ibn malik', 'kab', 'ka b'], narrators: ['കഅ്ബ്'] },
  { en: ['bashir', 'numan ibn bashir'], narrators: ['ബശീർ'] },
];

/** lowercase, drop diacritics/punctuation, then fold the usual transliteration spellings together */
export function latinKey(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\b(al|an|ad|ar|as|ash|at|az|ibn|bin)\b/g, (m) => (m === 'ibn' || m === 'bin' ? 'ibn' : '')) // drop article prefixes
    .replace(/ou/g, 'u').replace(/oo/g, 'u').replace(/ee/g, 'i').replace(/aa/g, 'a')
    .replace(/ay/g, 'ai').replace(/dh|th|kh|sh|gh/g, (m) => m[0])
    .replace(/h/g, '')
    .replace(/(.)\1+/g, '$1')
    .replace(/\s+/g, '');
}

const index = (list: Entry[]) => list.flatMap((e) => e.en.map((k) => ({ key: latinKey(k), e })));
const TOPIC_INDEX = index(TOPICS);
const NARRATOR_INDEX = index(NARRATORS);

const hasLatin = (s: string) => /[a-z]/i.test(s) && !/[ഀ-ൿ؀-ۿ]/.test(s);

/** Malayalam words to add to a search typed in English (empty when the query is already Malayalam/Arabic). */
export function expandQuery(q: string): { terms: string[]; narrators: string[] } {
  const none = { terms: [] as string[], narrators: [] as string[] };
  if (!hasLatin(q)) return none;
  const k = latinKey(q);
  if (k.length < 2) return none;
  const terms = new Set<string>();
  const narrators = new Set<string>();
  // exact (folded) match wins; otherwise any entry whose key is contained in the query or starts with it (typing)
  const exact = (ix: typeof TOPIC_INDEX) => ix.filter((x) => x.key === k);
  const loose = (ix: typeof TOPIC_INDEX) => ix.filter((x) => (k.length >= 4 && x.key.startsWith(k)) || (x.key.length >= 4 && k.includes(x.key)));
  for (const ix of [TOPIC_INDEX, NARRATOR_INDEX]) {
    const hits = exact(ix).length ? exact(ix) : loose(ix);
    for (const { e } of hits) {
      e.text?.forEach((t) => terms.add(t));
      e.narrators?.forEach((n) => narrators.add(n));
    }
  }
  return { terms: [...terms], narrators: [...narrators] };
}
