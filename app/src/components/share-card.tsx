import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { citation, shareText, stripNarrator } from '@/lib/text';
import { radius, space } from '@/lib/theme';
import type { Hadith } from '@/lib/types';
import { useSettings } from '@/state/settings';

import { Chip, IconButton, Row, T } from './ui';

type Ctx = { open: (h: Hadith) => void };
const CardContext = createContext<Ctx>({ open: () => {} });

/** "Share as image": opens a preview of a pretty card with the hadith, then shares it as a PNG. */
export const useShareCard = () => useContext(CardContext);

export function ShareCardProvider({ children }: { children: ReactNode }) {
  const [h, setH] = useState<Hadith | null>(null);
  const open = useCallback((x: Hadith) => setH(x), []);
  const value = useMemo(() => ({ open }), [open]);
  return (
    <CardContext.Provider value={value}>
      {children}
      {h && <CardModal h={h} onClose={() => setH(null)} />}
    </CardContext.Provider>
  );
}

// the card has fixed colours so every image looks the same, whatever theme the reader uses
const C = { bg: '#FFFDF8', text: '#17201B', muted: '#6B756E', accent: '#0F6B4F', gold: '#B8860B', line: '#E9D9AE' };

/** cut at a sentence/word boundary so the card never ends mid-word */
function clip(t: string, max: number) {
  const s = t.trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('। '), cut.lastIndexOf('؟ '), cut.lastIndexOf('. '));
  return (stop > max * 0.6 ? cut.slice(0, stop + 1) : cut.slice(0, cut.lastIndexOf(' '))) + ' …';
}

function CardView({ h }: { h: Hadith }) {
  const { fonts } = useSettings();
  const src = h.source_codes_ml?.length ? ` (${h.source_codes_ml.join(', ')})` : '';
  const ml = stripNarrator(h.malayalam_text, h.narrator_ml);
  const trimmed = h.arabic_text.length > 420 || ml.length > 700;
  return (
    <View style={styles.card} collapsable={false}>
      <View style={styles.head}>
        <View style={styles.logo}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>ح</Text></View>
        <View>
          <Text style={{ color: C.text, fontWeight: '700', fontSize: 14 }}>Hadees Vijnanakosham</Text>
          <Text style={{ color: C.muted, fontSize: 12, fontFamily: fonts.ml }}>ഹദീസ് വിജ്ഞാനകോശം</Text>
        </View>
      </View>
      <View style={styles.rule} />
      <Text style={{ fontFamily: fonts.ar, fontSize: 22, lineHeight: 42, color: C.text, textAlign: 'right', writingDirection: 'rtl' }}>
        {clip(h.arabic_text, 420)}
      </Text>
      <View style={[styles.rule, { marginVertical: 14 }]} />
      {h.narrator_ml ? <Text style={{ fontFamily: fonts.mlBold, fontSize: 15, color: C.accent, marginBottom: 4 }}>{h.narrator_ml}</Text> : null}
      <Text style={{ fontFamily: fonts.ml, fontSize: 16, lineHeight: 28, color: C.text }}>{clip(ml, 700) + src}</Text>
      <View style={[styles.rule, { marginTop: 16 }]} />
      <Text style={{ color: C.muted, fontSize: 12, marginTop: 8, fontFamily: fonts.ml }}>{citation(h)}{trimmed ? ' · abridged' : ''}</Text>
      <Text style={{ color: C.gold, fontSize: 11, marginTop: 2 }}>hadees-vijnanakosham.pages.dev</Text>
    </View>
  );
}

function CardModal({ h, onClose }: { h: Hadith; onClose: () => void }) {
  const { colors } = useSettings();
  const insets = useSafeAreaInsets();
  const ref = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function shareImage() {
    setBusy(true);
    setNote('');
    try {
      if (Platform.OS === 'web') {
        const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'data-uri' });
        const blob = await (await fetch(uri)).blob();
        const f = new File([blob], `hadith-${h.id}.png`, { type: 'image/png' });
        const nav = navigator as Navigator & { canShare?: (d: object) => boolean };
        if (nav.canShare?.({ files: [f] })) await navigator.share({ files: [f] });
        else {
          const a = document.createElement('a');
          a.href = uri;
          a.download = f.name;
          a.click();
        }
      } else {
        const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share hadith' });
        else setNote('Sharing is not available on this device.');
      }
    } catch (e) {
      if (!(e instanceof Error && /abort|cancel/i.test(e.name + e.message))) setNote('Could not make the image. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={[styles.panel, { backgroundColor: colors.surface, paddingBottom: insets.bottom + space.md, marginTop: insets.top + space.md }]}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T weight="bold">Share as image</T>
            <IconButton name="close" label="Close" size={22} onPress={onClose} />
          </Row>
          <ScrollView contentContainerStyle={{ alignItems: 'center', paddingVertical: space.md }} showsVerticalScrollIndicator={false}>
            <View ref={ref} collapsable={false}><CardView h={h} /></View>
          </ScrollView>
          {note ? <T variant="caption" color="danger" center>{note}</T> : null}
          <Row style={{ justifyContent: 'center', marginTop: space.sm }}>
            <Chip icon="image-outline" label={busy ? 'Preparing…' : 'Share image'} active onPress={busy ? undefined : shareImage} />
            <Chip
              icon="text-outline"
              label="Share text"
              onPress={() => (Platform.OS === 'web' && !(navigator as any).share ? Clipboard.setStringAsync(shareText(h)) : Share.share({ message: shareText(h) }))}
            />
          </Row>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  panel: { width: '94%', maxWidth: 440, maxHeight: '92%', borderRadius: radius.xl, padding: space.md },
  card: { width: 340, backgroundColor: C.bg, padding: 20, borderWidth: 1, borderColor: C.line },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  rule: { height: 1, backgroundColor: C.line, marginTop: 12, marginBottom: 12 },
});
