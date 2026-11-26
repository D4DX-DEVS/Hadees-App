/**
 * The optional grade of an encyclopedia hadith, set in the editor admin page (columns hadiths.grade / grade_by,
 * api/editor-extras.sql). The values are fixed by the check constraint hadiths_grade_check.
 */
export type GradeValue =
  | 'sahih' | 'sahih_li_ghairihi' | 'hasan_sahih' | 'hasan' | 'hasan_li_ghairihi'
  | 'daif' | 'very_daif' | 'mawdu';

export type GradeFields = { grade?: GradeValue | string | null; grade_by?: string | null };

export type GradeTone = 'accepted' | 'weak';

export type GradeInfo = {
  en: string;
  ml: string;
  ar: string;
  tone: GradeTone;
  /** what the grade means, for readers */
  info_ml: string;
  info_en: string;
};

export const GRADES: Record<GradeValue, GradeInfo> = {
  sahih: {
    en: 'Sahih', ml: 'സ്വഹീഹ്', ar: 'صحيح', tone: 'accepted',
    info_ml: 'നിവേദക പരമ്പര മുറിയാതെ, നീതിമാന്മാരും കൃത്യമായി ഓർത്തുവെക്കുന്നവരുമായ നിവേദകരിലൂടെ വന്നതും അപൂർവതയോ (ശുദൂദ്) ഗൂഢമായ ന്യൂനതയോ (ഇല്ലത്ത്) ഇല്ലാത്തതുമായ ഹദീസ്. തെളിവായി സ്വീകരിക്കപ്പെടുന്നു.',
    info_en: 'An unbroken chain of upright narrators with precise memory, with no irregularity (shudhudh) and no hidden defect (‘illah). Accepted as evidence.',
  },
  sahih_li_ghairihi: {
    en: 'Sahih li-ghairihi', ml: 'സ്വഹീഹ് ലിഗൈരിഹി', ar: 'صحيح لغيره', tone: 'accepted',
    info_ml: 'സ്വന്തം നിലയിൽ ഹസനായ ഹദീസ്, മറ്റു പരമ്പരകളുടെ പിൻബലത്താൽ സ്വഹീഹിന്റെ പദവിയിലെത്തിയത്. സ്വീകാര്യം.',
    info_en: 'Hasan on its own, raised to sahih by other supporting chains. Accepted.',
  },
  hasan_sahih: {
    en: 'Hasan Sahih', ml: 'ഹസൻ സ്വഹീഹ്', ar: 'حسن صحيح', tone: 'accepted',
    info_ml: 'ഇമാം തിർമിദി ഉപയോഗിക്കുന്ന പ്രയോഗം: ഹസൻ എന്നും സ്വഹീഹ് എന്നും വിധിക്കപ്പെട്ട ഹദീസ് (ഉദാ: രണ്ട് പരമ്പരകളിലൂടെ വന്നത്). സ്വീകാര്യം.',
    info_en: 'A term of Imam at-Tirmidhi: judged both hasan and sahih (for example through two chains). Accepted.',
  },
  hasan: {
    en: 'Hasan', ml: 'ഹസൻ', ar: 'حسن', tone: 'accepted',
    info_ml: 'സ്വഹീഹിന്റെ നിബന്ധനകളെല്ലാമുള്ളതും എന്നാൽ ഒരു നിവേദകന്റെ ഓർമശക്തി അൽപം കുറഞ്ഞതുമായ ഹദീസ്. തെളിവായി സ്വീകരിക്കപ്പെടുന്നു.',
    info_en: 'Meets the conditions of sahih, but one narrator’s precision is slightly lower. Accepted as evidence.',
  },
  hasan_li_ghairihi: {
    en: 'Hasan li-ghairihi', ml: 'ഹസൻ ലിഗൈരിഹി', ar: 'حسن لغيره', tone: 'accepted',
    info_ml: 'സ്വന്തം നിലയിൽ നേരിയ ദുർബലതയുള്ളതും മറ്റു പരമ്പരകളുടെ പിൻബലത്താൽ ഹസനായി ഉയർന്നതുമായ ഹദീസ്. സ്വീകാര്യം.',
    info_en: 'Slightly weak on its own, raised to hasan by other chains. Accepted.',
  },
  daif: {
    en: 'Da‘if', ml: 'ളഈഫ്', ar: 'ضعيف', tone: 'weak',
    info_ml: 'സ്വഹീഹിന്റെയോ ഹസനിന്റെയോ ഒന്നോ അതിലധികമോ നിബന്ധനകൾ ഇല്ലാത്ത ദുർബലമായ ഹദീസ്. വിധികൾക്ക് തെളിവായി എടുക്കില്ല.',
    info_en: 'Weak: misses one or more conditions of sahih or hasan. Not taken as evidence for rulings.',
  },
  very_daif: {
    en: 'Very weak', ml: 'കടുത്ത ളഈഫ്', ar: 'ضعيف جدا', tone: 'weak',
    info_ml: 'ഗുരുതരമായ ദുർബലതയുള്ള ഹദീസ് (ഉദാ: കളവ് ആരോപിക്കപ്പെട്ട നിവേദകൻ). മറ്റു പരമ്പരകൾ കൊണ്ട് ഉയരുകയില്ല.',
    info_en: 'Severely weak (for example a narrator accused of lying). Other chains do not raise it.',
  },
  mawdu: {
    en: 'Mawdu‘', ml: 'മൗളൂഅ്', ar: 'موضوع', tone: 'weak',
    info_ml: 'നബി(സ)യുടെ പേരിൽ കെട്ടിച്ചമച്ച ഹദീസ്. മുന്നറിയിപ്പ് നൽകാനല്ലാതെ ഉദ്ധരിക്കാൻ പാടില്ല.',
    info_en: 'Fabricated and falsely attributed to the Prophet ﷺ. Not to be narrated except to warn against it.',
  },
};

/** the grade of a hadith (any row from the API), or null when it has none (or an unknown value) */
export function gradeOf(h: object): (GradeInfo & { value: GradeValue; by: string | null }) | null {
  const { grade, grade_by } = h as GradeFields;
  if (typeof grade !== 'string' || !(grade in GRADES)) return null;
  const by = typeof grade_by === 'string' && grade_by.trim() ? grade_by.trim() : null;
  return { ...GRADES[grade as GradeValue], value: grade as GradeValue, by };
}
