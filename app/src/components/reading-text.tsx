import { Text } from 'react-native';

import { highlight, stripHarakat } from '@/lib/text';
import { useSettings } from '@/state/settings';

/** Text with search hits highlighted. */
export function Highlighted({ text, query, style, numberOfLines }: { text: string; query?: string; style: object; numberOfLines?: number }) {
  const { colors } = useSettings();
  const parts = highlight(text, query);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((p, i) =>
        p.hit ? (
          <Text key={i} style={{ backgroundColor: colors.highlight, borderRadius: 3 }}>{p.text}</Text>
        ) : (
          p.text
        ),
      )}
    </Text>
  );
}

/**
 * The ONLY place hadith typography is defined, so every screen looks identical:
 *  Arabic    = chosen Arabic font (regular), Settings size, line-height x1.9, Settings alignment, RTL
 *  Malayalam = chosen Malayalam font (regular), Settings size (>=16), Settings line spacing, Settings alignment
 * `size` is intentionally not accepted any more: nothing may shrink or grow text on its own.
 */
export function ArabicText({ text, query, numberOfLines }: { text: string; query?: string; numberOfLines?: number }) {
  const { settings, fonts, colors } = useSettings();
  const s = settings.arSize;
  const t = settings.showHarakat ? text : stripHarakat(text);
  return (
    <Highlighted
      text={t}
      query={query}
      numberOfLines={numberOfLines}
      style={{
        fontFamily: fonts.ar, fontSize: s, lineHeight: Math.round(s * 1.9), color: colors.text,
        textAlign: settings.arAlign, writingDirection: 'rtl',
      }}
    />
  );
}

export function MalayalamText({ text, query, muted, numberOfLines }: { text: string; query?: string; muted?: boolean; numberOfLines?: number }) {
  const { settings, fonts, colors } = useSettings();
  const s = Math.max(16, settings.mlSize);
  return (
    <Highlighted
      text={text}
      query={query}
      numberOfLines={numberOfLines}
      style={{
        fontFamily: fonts.ml, fontSize: s, lineHeight: Math.round(s * settings.lineHeight), color: muted ? colors.textMuted : colors.text,
        textAlign: settings.mlAlign,
      }}
    />
  );
}
