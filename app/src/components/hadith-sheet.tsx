import { router } from 'expo-router';
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useSettings } from '@/state/settings';

import { HadithActions, HadithHeading, HadithMeta, HadithText } from './hadith';
import { Chip, ErrorView, IconButton, Loading, Row, T } from './ui';

type Ctx = { open: (id: number) => void };
const SheetContext = createContext<Ctx>({ open: () => {} });

/** Open any hadith in a bottom popup from anywhere (cross references, AI references, citations). */
export const useHadithSheet = () => useContext(SheetContext);

export function HadithSheetProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<number | null>(null);
  const open = useCallback((n: number) => setId(n), []);
  const value = useMemo(() => ({ open }), [open]);
  return (
    <SheetContext.Provider value={value}>
      {children}
      {id !== null && <Sheet id={id} onClose={() => setId(null)} />}
    </SheetContext.Provider>
  );
}

function Sheet({ id: startId, onClose }: { id: number; onClose: () => void }) {
  const [id, setId] = useState(startId);
  const { colors } = useSettings();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { data: h, error, reload } = useLoad(() => api.hadith(id), [id]);
  const nav = useLoad(() => (h ? api.neighbours(h) : Promise.resolve({} as { prev?: number; next?: number })), [h?.id]).data ?? ({} as { prev?: number; next?: number });
  // same swipe as the hadith page: left = next, right = previous
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-40, 40])
        .failOffsetY([-14, 14])
        .onEnd((e) => {
          const to = e.translationX < -90 ? nav.next : e.translationX > 90 ? nav.prev : undefined;
          if (to) setId(to);
        }),
    [nav.next, nav.prev],
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + space.md, maxHeight: height * 0.88 }]}>
          <View style={[styles.grab, { backgroundColor: colors.border }]} />
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, paddingRight: space.sm }}>
              <T variant="tiny" color="faint" weight="bold" style={{ letterSpacing: 0.6 }}>HADITH</T>
            </View>
            <IconButton name="close" label="Close" size={22} onPress={onClose} />
          </Row>

          {error ? (
            <ErrorView error={error} onRetry={reload} />
          ) : !h ? (
            <Loading />
          ) : (
            <GestureDetector gesture={swipe}>
              <View style={{ flexShrink: 1 }}>
                <HadithHeading h={h} full />
                <ScrollView style={{ marginTop: space.sm }} showsVerticalScrollIndicator persistentScrollbar>
                  <View style={{ gap: space.md }}>
                    <HadithText h={h} />
                    <HadithMeta h={h} />
                  </View>
                </ScrollView>
                <Row style={{ justifyContent: 'space-between', marginTop: space.md }}>
                  <Chip
                    icon="open-outline"
                    label="Open full page"
                    onPress={() => {
                      onClose();
                      router.push({ pathname: '/hadith/[id]', params: { id: String(h.id) } });
                    }}
                  />
                  <HadithActions h={h} compact />
                </Row>
                <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
                  <IconButton name="chevron-back" label="Previous hadith" disabled={!nav.prev} onPress={() => nav.prev && setId(nav.prev)} />
                  <T variant="caption" color="faint">Swipe or tap to move between hadith</T>
                  <IconButton name="chevron-forward" label="Next hadith" disabled={!nav.next} onPress={() => nav.next && setId(nav.next)} />
                </Row>
              </View>
            </GestureDetector>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    width: '100%', maxWidth: 680, alignSelf: 'center', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg, paddingTop: space.sm,
  },
  grab: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: space.sm },
});
