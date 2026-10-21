import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { SOURCES, sourceName } from '@/lib/sources';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useSettings } from '@/state/settings';

import { Chip, IconButton, Row, T } from './ui';

/** Source codes (ബു, മു, ത …) as tappable chips; tap = full book name + "all hadith from this source". */
export function SourceChips({ codes, label = true }: { codes: string[] | null | undefined; label?: boolean }) {
  const { colors } = useSettings();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState<string | null>(null);
  const sources = useLoad(() => api.sources(), []).data ?? [];
  if (!codes?.length) return null;
  const sel = open ? sources.find((s) => s.code_ml === open) ?? null : null;
  const info = open ? SOURCES[open] : undefined;

  return (
    <>
      <Row wrap gap={6}>
        {label && <T variant="caption" color="muted">Source:</T>}
        {codes.map((c) => (
          <Chip key={c} label={sourceName(c, 'full')} icon="book-outline" onPress={() => setOpen(c)} style={{ paddingVertical: 5, paddingHorizontal: 10 }} />
        ))}
      </Row>
      <Modal visible={!!open} transparent animationType="slide" onRequestClose={() => setOpen(null)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(null)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + space.lg }]}
            onPress={() => {}}>
            <View style={[styles.grab, { backgroundColor: colors.border }]} />
            <Row style={{ justifyContent: 'space-between' }}>
              <T variant="tiny" color="faint" weight="bold">SOURCE</T>
              <IconButton name="close" label="Close" size={20} onPress={() => setOpen(null)} />
            </Row>
            {info || sel ? (
              <>
                <T variant="heading">{info?.full ?? sel?.name_en}</T>
                <T color="muted">{info?.ar ?? sel?.name_ar}</T>
                <T variant="caption" color="faint">{`${info?.ml ?? sel?.name_ml ?? ''} · printed as "${open}"`}</T>
                <Chip
                  label="All hadith from this source"
                  icon="search"
                  onPress={() => {
                    setOpen(null);
                    router.push({ pathname: '/search', params: { src: open!, q: '' } });
                  }}
                  style={{ alignSelf: 'flex-start', marginTop: space.md }}
                />
              </>
            ) : (
              <T color="muted">{`"${open}" is printed in the book for this hadith, but its source is not listed in the legend.`}</T>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    width: '100%', maxWidth: 640, alignSelf: 'center', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg, paddingTop: space.sm, gap: 4,
  },
  grab: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: space.sm },
});
