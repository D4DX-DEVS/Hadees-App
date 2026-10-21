import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { load, save } from '@/lib/storage';
import { arabicFonts, malayalamFonts, Palette, palettes, ThemeName } from '@/lib/theme';

export type Align = 'left' | 'center' | 'right' | 'justify';

export type Settings = {
  theme: 'system' | ThemeName;
  mlFont: string;          // malayalamFonts[].key
  arFont: string;          // arabicFonts[].key
  mlSize: number;          // px
  arSize: number;          // px
  lineHeight: number;      // multiplier
  mlAlign: Align;          // Malayalam text alignment
  arAlign: Align;          // Arabic text alignment
  showArabic: boolean;
  showHarakat: boolean;
  showNarrator: boolean;
  arabicFirst: boolean;
  arabicCollapsed: boolean; // Malayalam first, Arabic behind a "Show Arabic" button
};

const DEFAULTS: Settings = {
  theme: 'system',
  mlFont: 'noto-sans',
  arFont: 'amiri',
  mlSize: 17,
  arSize: 24,
  lineHeight: 1.7,
  mlAlign: 'left',
  arAlign: 'right',
  showArabic: true,
  showHarakat: true,
  showNarrator: true,
  arabicFirst: true,
  arabicCollapsed: false,
};

const KEY = 'hv.settings.v1';

type Ctx = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  colors: Palette;
  themeName: ThemeName;
  fonts: { ml: string; mlMedium: string; mlBold: string; ar: string; arBold: string };
  ready: boolean;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const scheme = useColorScheme();

  useEffect(() => {
    load(KEY, DEFAULTS).then((s) => {
      setSettings({ ...s, mlSize: Math.max(16, s.mlSize), mlAlign: s.mlAlign === 'justify' ? 'left' : s.mlAlign }); // Malayalam: never below 16 px, never justified
      setReady(true);
    });
  }, []);

  const value = useMemo<Ctx>(() => {
    const themeName: ThemeName = settings.theme === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : settings.theme;
    const ml = malayalamFonts.find((f) => f.key === settings.mlFont) ?? malayalamFonts[0];
    const ar = arabicFonts.find((f) => f.key === settings.arFont) ?? arabicFonts[0];
    return {
      settings,
      ready,
      themeName,
      colors: palettes[themeName],
      fonts: { ml: ml.regular, mlMedium: ml.medium ?? ml.regular, mlBold: ml.bold, ar: ar.regular, arBold: ar.bold },
      update: (patch) =>
        setSettings((s) => {
          const next = { ...s, ...patch };
          save(KEY, next);
          return next;
        }),
      reset: () => {
        setSettings(DEFAULTS);
        save(KEY, DEFAULTS);
      },
    };
  }, [settings, scheme, ready]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings outside SettingsProvider');
  return ctx;
}
