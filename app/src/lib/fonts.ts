import { Amiri_400Regular } from '@expo-google-fonts/amiri/400Regular';
import { Amiri_700Bold } from '@expo-google-fonts/amiri/700Bold';
import { Gayathri_400Regular } from '@expo-google-fonts/gayathri/400Regular';
import { Gayathri_700Bold } from '@expo-google-fonts/gayathri/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Manjari_400Regular } from '@expo-google-fonts/manjari/400Regular';
import { Manjari_700Bold } from '@expo-google-fonts/manjari/700Bold';
import { NotoNaskhArabic_400Regular } from '@expo-google-fonts/noto-naskh-arabic/400Regular';
import { NotoNaskhArabic_600SemiBold } from '@expo-google-fonts/noto-naskh-arabic/600SemiBold';
import { NotoSansMalayalam_400Regular } from '@expo-google-fonts/noto-sans-malayalam/400Regular';
import { NotoSansMalayalam_500Medium } from '@expo-google-fonts/noto-sans-malayalam/500Medium';
import { NotoSansMalayalam_600SemiBold } from '@expo-google-fonts/noto-sans-malayalam/600SemiBold';
import { NotoSerifMalayalam_400Regular } from '@expo-google-fonts/noto-serif-malayalam/400Regular';
import { NotoSerifMalayalam_500Medium } from '@expo-google-fonts/noto-serif-malayalam/500Medium';
import { NotoSerifMalayalam_600SemiBold } from '@expo-google-fonts/noto-serif-malayalam/600SemiBold';
import { ScheherazadeNew_400Regular } from '@expo-google-fonts/scheherazade-new/400Regular';
import { ScheherazadeNew_700Bold } from '@expo-google-fonts/scheherazade-new/700Bold';
import * as Font from 'expo-font';

/** font family name -> asset. Only the families in use are loaded (see ensureFonts). */
export const FONT_ASSETS: Record<string, number> = {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  NotoSansMalayalam_400Regular, NotoSansMalayalam_500Medium, NotoSansMalayalam_600SemiBold,
  NotoSerifMalayalam_400Regular, NotoSerifMalayalam_500Medium, NotoSerifMalayalam_600SemiBold,
  Manjari_400Regular, Manjari_700Bold,
  Gayathri_400Regular, Gayathri_700Bold,
  Amiri_400Regular, Amiri_700Bold,
  ScheherazadeNew_400Regular, ScheherazadeNew_700Bold,
  NotoNaskhArabic_400Regular, NotoNaskhArabic_600SemiBold,
};

export async function ensureFonts(names: string[]) {
  const missing = names.filter((n) => FONT_ASSETS[n] && !Font.isLoaded(n));
  if (!missing.length) return;
  await Font.loadAsync(Object.fromEntries(missing.map((n) => [n, FONT_ASSETS[n]])));
}
