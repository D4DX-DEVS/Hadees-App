import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ArabicTitle, Column, Divider, Empty, ErrorView, Loading, T, useUiFont } from '@/components/ui';
import { api } from '@/lib/api';
import { mlKey, stripHarakat } from '@/lib/text';
import { radius, space } from '@/lib/theme';
import type { Book, Chapter } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { useSettings } from '@/state/settings';

export default function BookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bookId = Number(id);
  const { colors } = useSettings();
  const font = useUiFont();
  const [filter, setFilter] = useState('');
  const { data, error, loading, reload } = useLoad(() => Promise.all([api.books(), api.chapters(bookId)]), [bookId]);
  const book: Book | null = data?.[0].find((b) => b.id === bookId) ?? null;
  const chapters: Chapter[] = useMemo(() => data?.[1] ?? [], [data]);

  const shown = useMemo(() => {
    const f = filter.trim();
    if (!f) return chapters;
    const k = mlKey(f);
    const a = stripHarakat(f);
    return chapters.filter(
      (c) => mlKey(c.title_ml).includes(k) || stripHarakat(c.title_ar ?? '').includes(a) || String(c.chapter_no) === f,
    );
  }, [filter, chapters]);

  if (error) return <ErrorView error={error} onRetry={reload} />;
  if (loading) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: book?.title_ml ?? '' }} />
      <FlatList
        data={shown}
        keyExtractor={(c) => String(c.id)}
        ListHeaderComponent={
          <Column style={{ paddingTop: space.lg, paddingBottom: space.md }}>
            {book && (
              <View style={{ alignItems: 'center', marginBottom: space.lg }}>
                <T variant="tiny" color="faint" weight="bold">Volume {book.volume_id} · Book {book.book_no}</T>
                {book.title_ar ? (
                  <ArabicTitle variant="title">{book.title_ar}</ArabicTitle>
                ) : null}
                <T variant="heading" center>{book.title_ml}</T>
                <T variant="caption" color="muted" style={{ marginTop: 4 }}>
                  {book.hadith_count} hadith · {book.chapter_count} chapters
                </T>
              </View>
            )}
            {chapters.length > 12 && (
              <View style={[styles.filter, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name="filter" size={16} color={colors.textMuted} />
                <TextInput
                  value={filter}
                  onChangeText={setFilter}
                  placeholder="Find a chapter…"
                  placeholderTextColor={colors.textFaint}
                  style={[{ flex: 1, color: colors.text, fontFamily: font(), fontSize: 15 }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
                />
              </View>
            )}
          </Column>
        }
        renderItem={({ item: c, index }) => {
          const empty = c.hadith_count === 0;
          return (
            <Column>
              {index > 0 && <Divider />}
              <Pressable
                disabled={empty}
                onPress={() => router.push({ pathname: '/chapter/[id]', params: { id: String(c.id) } })}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
                <T variant="caption" color="gold" weight="bold" style={{ width: 32 }}>{c.chapter_no}</T>
                <View style={{ flex: 1, gap: 2 }}>
                  {c.title_ar ? <ArabicTitle variant="row">{c.title_ar}</ArabicTitle> : null}
                  <T color={empty ? 'faint' : 'text'}>{c.title_ml}</T>
                  <T variant="tiny" color="faint">
                    {empty ? 'Hadith not available' : c.first_no === c.last_no ? `Hadith ${c.first_no}` : `Hadith ${c.first_no}–${c.last_no} · ${c.hadith_count}`}
                  </T>
                </View>
                {!empty && <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />}
              </Pressable>
            </Column>
          );
        }}
        ListEmptyComponent={<Empty title="No chapters" />}
        contentContainerStyle={{ paddingBottom: 64 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, paddingHorizontal: 12, borderRadius: radius.md },
  inBook: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: space.md, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1 },
});
