import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import type { Hadith } from '@/lib/types';
import { useHadithSheet } from './hadith-sheet';
import { useSettings } from '@/state/settings';

/**
 * Renders an AI answer: light markdown (bullets, **bold**, headings) and [n] citations
 * that open the cited hadith.
 */
export function AnswerText({ text: full, sources, animate = false }: { text: string; sources: Hadith[]; animate?: boolean }) {
  const { fonts, colors, settings } = useSettings();
  const { open: openSheet } = useHadithSheet();
  // answers "type in" quickly (about 1.5 s at most) instead of popping in all at once
  const [shown, setShown] = useState(animate ? 0 : full.length);
  useEffect(() => {
    if (!animate) return;
    const step = Math.max(2, Math.ceil(full.length / 80));
    const id = setInterval(() => setShown((n) => (n + step >= full.length ? (clearInterval(id), full.length) : n + step)), 18);
    return () => clearInterval(id);
  }, [animate, full]);
  const text = full.slice(0, shown);
  const size = Math.max(16, Math.min(settings.mlSize, 17));
  const base = { fontFamily: fonts.ml, fontSize: size, lineHeight: Math.round(size * 1.7), color: colors.text, textAlign: settings.mlAlign };

  const inline = (line: string, key: string) =>
    line.split(/(\*\*[^*]+\*\*|\[\d+(?:\s*,\s*\d+)*\])/g).map((part, i) => {
      if (!part) return null;
      const bold = part.match(/^\*\*([^*]+)\*\*$/);
      if (bold) return <Text key={`${key}-${i}`} style={{ fontFamily: fonts.mlBold }}>{bold[1]}</Text>;
      const cite = part.match(/^\[([\d,\s]+)\]$/);
      if (cite) {
        return cite[1].split(',').map((n) => {
          const idx = parseInt(n.trim(), 10) - 1;
          const src = sources[idx];
          return (
            <Text
              key={`${key}-${i}-${n}`}
              onPress={src ? () => openSheet(src.id) : undefined}
              style={{ color: colors.accent, fontFamily: fonts.mlBold, fontSize: Math.max(13, size - 3) }}>
              {` [${n.trim()}]`}
            </Text>
          );
        });
      }
      return part;
    });

  const lines = text.split('\n');
  return (
    <View style={{ gap: 4 }}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <View key={i} style={{ height: 4 }} />;
        const h = line.match(/^#{1,4}\s+(.*)$/);
        if (h) return <Text key={i} style={[base, { fontFamily: fonts.mlBold, marginTop: 6 }]}>{inline(h[1], `h${i}`)}</Text>;
        const li = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
        if (li) {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 8, paddingLeft: 4 }}>
              <Text style={[base, { color: colors.accent }]}>•</Text>
              <Text style={[base, { flex: 1 }]}>{inline(li[1], `l${i}`)}</Text>
            </View>
          );
        }
        return <Text key={i} style={base}>{inline(line, `p${i}`)}</Text>;
      })}
    </View>
  );
}
