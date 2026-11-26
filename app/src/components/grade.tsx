import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { gradeOf } from '@/lib/grades';
import { radius, space } from '@/lib/theme';
import { useSettings } from '@/state/settings';

import { T } from './ui';

/** A small grade pill for list cards (nothing when the hadith has no grade). */
export function GradeBadge({ h }: { h: object }) {
  const { colors } = useSettings();
  const g = gradeOf(h);
  if (!g) return null;
  const weak = g.tone === 'weak';
  return (
    <View
      accessibilityLabel={`Grade: ${g.en}${g.by ? `, by ${g.by}` : ''}`}
      style={[styles.pill, { backgroundColor: weak ? colors.danger + '1F' : colors.accentSoft }]}>
      <T variant="tiny" weight="bold" color={weak ? 'danger' : 'accent'}>{g.ml}</T>
    </View>
  );
}

/** The grade on the hadith page: label, who graded it, and (tap) what the grade means. */
export function GradeLine({ h }: { h: object }) {
  const { colors } = useSettings();
  const [open, setOpen] = useState(false);
  const g = gradeOf(h);
  if (!g) return null;
  const weak = g.tone === 'weak';
  const tint = weak ? colors.danger : colors.accent;
  return (
    <Pressable
      onPress={() => setOpen((o) => !o)}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`Grade: ${g.en}${g.by ? `, graded by ${g.by}` : ''}. ${open ? 'Hide' : 'Show'} what it means`}
      style={[styles.line, { backgroundColor: weak ? colors.danger + '14' : colors.accentSoft, borderColor: tint + '40' }]}>
      <View style={styles.head}>
        <Ionicons name={weak ? 'alert-circle-outline' : 'shield-checkmark-outline'} size={20} color={tint} />
        <View style={{ flex: 1 }}>
          <T variant="label" weight="bold" color={weak ? 'danger' : 'accent'}>{`${g.ml} · ${g.en}`}</T>
          {g.by ? <T variant="caption" color="muted">{`Graded by ${g.by}`}</T> : null}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'information-circle-outline'} size={18} color={colors.textMuted} />
      </View>
      {open ? (
        <View style={{ gap: space.xs, marginTop: space.sm }}>
          <T variant="caption">{g.info_ml}</T>
          <T variant="caption" color="muted">{g.info_en}</T>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  line: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
