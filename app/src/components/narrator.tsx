import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useSettings } from '@/state/settings';

import { MalayalamText } from './reading-text';
import { Chip, IconButton, Loading, Row, T } from './ui';

/**
 * Narrator name for a hadith. If the book has a biography for this narrator the name is tappable
 * and opens a bottom sheet with the details; otherwise it is plain text.
 */
export function NarratorName({ name }: { name: string }) {
  const map = useLoad(() => api.narratorMap(), []).data;
  const id = map?.get(name);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`About ${name}`} style={{ alignSelf: 'flex-start', marginBottom: 6 }}>
        <T variant="label" color="accent" weight="bold" style={styles.link}>{name}</T>
      </Pressable>
      {open && (id ? <NarratorSheet id={id} onClose={() => setOpen(false)} /> : <NarratorByName name={name} onClose={() => setOpen(false)} />)}
    </>
  );
}

/** Narrator with no biography in the book: still tappable, shows the name and lets you list all their hadith. */
function NarratorByName({ name, onClose }: { name: string; onClose: () => void }) {
  const { colors } = useSettings();
  const insets = useSafeAreaInsets();
  const count = useLoad(() => api.narratorCount(name), [name]).data;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + space.lg }]}>
          <View style={[styles.grab, { backgroundColor: colors.border }]} />
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <T variant="tiny" color="faint" weight="bold" style={{ letterSpacing: 0.6 }}>NARRATOR</T>
              <T variant="heading">{name.replace(/\(റ\)\s*$/, '')}</T>
            </View>
            <IconButton name="close" label="Close" size={22} onPress={onClose} />
          </Row>
          <T color="muted" style={{ marginTop: space.sm }}>The book has no biography for this narrator.</T>
          <Row wrap style={{ marginTop: space.lg }}>
            <Chip
              icon="search"
              label={count === undefined ? 'Hadith narrated' : `${count} hadith narrated`}
              onPress={() => {
                onClose();
                router.push({ pathname: '/search', params: { narratorName: name, q: '' } });
              }}
            />
          </Row>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NarratorSheet({ id, onClose }: { id: number; onClose: () => void }) {
  const { colors } = useSettings();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { data: n, error } = useLoad(() => api.narrator(id), [id]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + space.lg }]}>
          <View style={[styles.grab, { backgroundColor: colors.border }]} />
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <T variant="tiny" color="faint" weight="bold" style={{ letterSpacing: 0.6 }}>NARRATOR</T>
              <T variant="heading">{n?.name_ml ?? '…'}</T>
            </View>
            <IconButton name="close" label="Close" size={20} onPress={onClose} />
          </Row>
          {!n && !error && <Loading />}
          {error ? <T color="danger">Could not load narrator details.</T> : null}
          {n && (
            <>
              {n.bio_ml ? (
                <ScrollView style={{ maxHeight: Math.max(120, height * 0.4), marginTop: space.sm }} showsVerticalScrollIndicator persistentScrollbar>
                  {n.bio_ml.split('\n\n').map((para, i) => (
                    <View key={i} style={{ marginBottom: space.sm }}>
                      <MalayalamText text={para} />
                    </View>
                  ))}
                  {n.source_note ? <T variant="tiny" color="faint" style={{ marginTop: space.xs }}>{n.source_note}</T> : null}
                </ScrollView>
              ) : (
                <T color="muted" style={{ marginTop: space.sm }}>The book has no biography for this narrator.</T>
              )}
              <Row wrap style={{ marginTop: space.lg }}>
                <Chip
                  icon="search"
                  label={`${n.hadith_count} hadith narrated`}
                  onPress={() => {
                    onClose();
                    router.push({ pathname: '/search', params: { narrator: String(n.id), q: '' } });
                  }}
                />
                {n.article_id ? (
                  <Chip
                    icon="document-text-outline"
                    label="Read the article"
                    onPress={() => {
                      onClose();
                      router.push({ pathname: '/article/[id]', params: { id: String(n.article_id) } });
                    }}
                  />
                ) : null}
              </Row>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  link: Platform.select({ web: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' }, default: { textDecorationLine: 'underline' } }) as object,
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    width: '100%', maxWidth: 640, alignSelf: 'center', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg, paddingTop: space.sm, gap: 4,
  },
  grab: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: space.sm },
});
