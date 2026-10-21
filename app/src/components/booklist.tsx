import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { api } from '@/lib/api';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useSettings } from '@/state/settings';

import { Appear, Skeleton } from './motion';
import { ArabicTitle, Card, Divider, ErrorView, SectionTitle, T } from './ui';

/** All books that have hadith loaded (used by the Library page and the home screen's Library mode). */
export function BookList({ title = true }: { title?: boolean }) {
  const { colors } = useSettings();
  const { data, error, loading, reload } = useLoad(() => api.books(), []);
  const ready = useMemo(() => (data ?? []).filter((b) => b.hadith_count > 0), [data]);

  if (error) return <ErrorView error={error} onRetry={reload} />;
  if (loading) {
    return (
      <View style={{ marginTop: space.xl, gap: space.sm }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 64, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt }} />
        ))}
      </View>
    );
  }
  return (
    <>
      {title && <SectionTitle>Books ({ready.length})</SectionTitle>}
      <Appear>
      <Card padded={false}>
        {ready.map((b, i) => (
          <View key={b.id}>
            {i > 0 && <Divider style={{ marginLeft: 64 }} />}
            <Pressable
              onPress={() => router.push({ pathname: '/book/[id]', params: { id: String(b.id) } })}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}>
              <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="book-outline" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <T weight="medium" numberOfLines={2}>{b.title_ml}</T>
                <T variant="tiny" color="faint">{`${b.hadith_count} hadith · ${b.chapter_count} chapters`}</T>
              </View>
              {b.title_ar ? (
                <View style={{ maxWidth: 140 }}><ArabicTitle variant="row">{b.title_ar}</ArabicTitle></View>
              ) : null}
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </Pressable>
          </View>
        ))}
      </Card>
      </Appear>
      <T variant="tiny" color="faint" center style={{ marginTop: space.lg }}>{ready.length} books</T>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, paddingHorizontal: space.lg },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
