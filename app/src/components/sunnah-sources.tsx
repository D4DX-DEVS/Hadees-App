import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Divider, SectionTitle, T } from '@/components/ui';
import type { SunnahPassage } from '@/lib/types';
import { space } from '@/lib/theme';
import { useSettings } from '@/state/settings';

const WEAK = /da['’`]?if|weak/i;

/**
 * Passages from Sunnah.com's English translations that the AI used. They are cited [n] after the encyclopedia references.
 * Tap one to read the English text and the Arabic, so the reader can check what the Malayalam summary is based on.
 */
export function SunnahSources({ items, firstNumber }: { items: SunnahPassage[]; firstNumber: number }) {
  const { colors, fonts, settings } = useSettings();
  const [open, setOpen] = useState<number | null>(null);
  if (!items.length) return null;
  const arSize = Math.max(18, Math.min(settings.arSize ?? 22, 26));
  return (
    <View style={{ marginTop: space.lg }}>
      <SectionTitle>{`Sunnah.com · English (${items.length})`}</SectionTitle>
      <T variant="tiny" color="faint" style={{ marginBottom: space.sm }}>
        The AI summarised these English texts in Malayalam, so the Malayalam wording can contain mistakes. Tap a passage to read the original.
      </T>
      <Card padded={false}>
        {items.map((p, i) => {
          const isOpen = open === i;
          const weak = WEAK.test(p.grade ?? '');
          return (
            <View key={`${p.label}-${i}`}>
              {i > 0 && <Divider />}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                accessibilityLabel={`${p.label}. ${isOpen ? 'Hide' : 'Show'} the original text`}
                onPress={() => setOpen(isOpen ? null : i)}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}>
                <View style={[styles.no, { backgroundColor: colors.accentSoft }]}>
                  <T variant="caption" weight="bold" color="accent">{firstNumber + i}</T>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="caption" weight="medium">{p.label}</T>
                  {p.grade ? (
                    <T variant="tiny" color={weak ? 'danger' : 'muted'} weight={weak ? 'bold' : 'regular'}>
                      {weak ? `Weak · ${p.grade}` : p.grade}
                    </T>
                  ) : null}
                  {p.narrator ? <T variant="tiny" color="faint" numberOfLines={isOpen ? undefined : 1}>{p.narrator}</T> : null}
                </View>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textFaint} />
              </Pressable>
              {isOpen && (
                <View style={[styles.body, { backgroundColor: colors.surfaceAlt }]}>
                  <T selectable>{p.text_en}</T>
                  {p.text_ar ? (
                    <Text
                      selectable
                      style={{ fontFamily: fonts.ar, fontSize: arSize, lineHeight: Math.round(arSize * 1.9), color: colors.text, textAlign: 'right', writingDirection: 'rtl', marginTop: space.md }}>
                      {p.text_ar}
                    </Text>
                  ) : null}
                </View>
              )}
            </View>
          );
        })}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, paddingHorizontal: space.md },
  no: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: space.md, paddingVertical: space.md },
});
