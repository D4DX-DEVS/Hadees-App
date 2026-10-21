import { Platform } from 'react-native';

export type ThemeName = 'light' | 'dark' | 'sepia';

export type Palette = {
  bg: string;          // page
  surface: string;     // cards
  surfaceAlt: string;  // inputs, chips
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;      // brand green
  accentSoft: string;  // tinted backgrounds
  onAccent: string;
  gold: string;        // hadith numbers, highlights
  goldSoft: string;    // tinted background behind hadith numbers
  highlight: string;   // search hit background
  danger: string;
};

export const palettes: Record<ThemeName, Palette> = {
  light: {
    bg: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceAlt: '#F4F4F1',
    border: '#E5E5E0',
    text: '#17201B',
    textMuted: '#5C665F',
    textFaint: '#6B756E',
    accent: '#0F6B4F',
    accentSoft: '#E3F1EA',
    onAccent: '#FFFFFF',
    gold: '#8E6212',
    goldSoft: '#FBF3E0',
    highlight: '#FCE9A8',
    danger: '#B42318',
  },
  dark: {
    bg: '#0E1210',
    surface: '#161B18',
    surfaceAlt: '#1E2420',
    border: '#2A312C',
    text: '#E8ECE9',
    textMuted: '#A3ADA6',
    textFaint: '#8C968F',
    accent: '#4CC79A',
    accentSoft: '#173126',
    onAccent: '#06140E',
    gold: '#E2B565',
    goldSoft: '#2B2412',
    highlight: '#5A4815',
    danger: '#F97066',
  },
  sepia: {
    bg: '#F4ECD8',
    surface: '#FBF5E6',
    surfaceAlt: '#EDE3CB',
    border: '#DCCFAF',
    text: '#3B2F1E',
    textMuted: '#6E5D43',
    textFaint: '#7B6A4B',
    accent: '#7A5520',
    accentSoft: '#EADBB8',
    onAccent: '#FFF8EA',
    gold: '#7E4A0C',
    goldSoft: '#EBD9AE',
    highlight: '#F2D589',
    danger: '#A3341F',
  },
};

// ───────── fonts ─────────
export type FontOption = { key: string; label: string; regular: string; medium?: string; bold: string };

export const malayalamFonts: FontOption[] = [
  { key: 'noto-sans', label: 'Noto Sans', regular: 'NotoSansMalayalam_400Regular', medium: 'NotoSansMalayalam_500Medium', bold: 'NotoSansMalayalam_600SemiBold' },
  { key: 'noto-serif', label: 'Noto Serif', regular: 'NotoSerifMalayalam_400Regular', medium: 'NotoSerifMalayalam_500Medium', bold: 'NotoSerifMalayalam_600SemiBold' },
  { key: 'manjari', label: 'Manjari', regular: 'Manjari_400Regular', bold: 'Manjari_700Bold' },
  { key: 'gayathri', label: 'Gayathri', regular: 'Gayathri_400Regular', bold: 'Gayathri_700Bold' },
];

export const arabicFonts: FontOption[] = [
  { key: 'amiri', label: 'Amiri', regular: 'Amiri_400Regular', bold: 'Amiri_700Bold' },
  { key: 'scheherazade', label: 'Scheherazade', regular: 'ScheherazadeNew_400Regular', bold: 'ScheherazadeNew_700Bold' },
  { key: 'naskh', label: 'Noto Naskh', regular: 'NotoNaskhArabic_400Regular', bold: 'NotoNaskhArabic_600SemiBold' },
];

export const uiFont = { regular: 'Inter_400Regular', medium: 'Inter_500Medium', bold: 'Inter_600SemiBold' };

export const radius = { sm: 8, md: 12, lg: 18, xl: 26, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const maxWidth = 760;

export const shadow = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)' } as object,
  default: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
});
