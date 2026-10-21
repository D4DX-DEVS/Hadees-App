import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BookList } from '@/components/booklist';
import { Card, Row, Screen, T } from '@/components/ui';
import { radius, space } from '@/lib/theme';
import { useLibrary } from '@/state/library';
import { useSettings } from '@/state/settings';

export default function LibraryScreen() {
  const { colors } = useSettings();
  const { reads } = useLibrary();
  const lastRead = reads[0];

  return (
    <Screen contentStyle={{ paddingTop: space.md }}>
      <Pressable onPress={() => router.push('/search')} style={[styles.search, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <T color="faint">Search the library…</T>
      </Pressable>

      {lastRead && (
        <Card onPress={() => router.push({ pathname: '/hadith/[id]', params: { id: String(lastRead.id) } })} style={{ marginTop: space.lg }}>
          <Row>
            <Ionicons name="play-circle" size={28} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <T variant="caption" color="muted">Continue reading</T>
              <T weight="medium" numberOfLines={1}>{lastRead.book_title_ml} · Hadith {lastRead.hadith_no}</T>
            </View>
          </Row>
        </Card>
      )}

      <BookList />
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, paddingHorizontal: 14,
    borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, marginTop: space.lg,
  },
});
