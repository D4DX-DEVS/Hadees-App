import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { HadithActions, HadithBody } from '@/components/hadith';
import { ArabicTitle, Badge, Column, Divider, ErrorView, IconButton, Loading, Row, T } from '@/components/ui';
import { api } from '@/lib/api';
import { space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useSettings } from '@/state/settings';

/** Continuous reader for one bab. */
export default function ChapterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chapterId = Number(id);
  const { colors } = useSettings();
  const { data, error, loading, reload } = useLoad(async () => {
    const rows = await api.chapterHadiths(chapterId);
    const cs = rows[0] ? await api.chapters(rows[0].book_id) : [];
    return { rows, siblings: cs.filter((c) => c.hadith_count > 0), chapter: cs.find((c) => c.id === chapterId) ?? null };
  }, [chapterId]);

  const counts = useLoad(() => api.refCounts(data?.rows.map((r) => r.id) ?? []), [data?.rows.length, chapterId]).data ?? {};

  const sib = data?.siblings ?? [];
  const at = sib.findIndex((c) => c.id === chapterId);
  const prevId = at > 0 ? sib[at - 1].id : undefined;
  const nextId = at >= 0 && at < sib.length - 1 ? sib[at + 1].id : undefined;
  // Next / Previous step through the hadith of this chapter (scrolling to each one); past the last / first
  // hadith they continue into the next / previous chapter.
  const list = useRef<FlatList>(null);
  const [cur, setCur] = useState(0);
  const total = data?.rows.length ?? 0;
  const latest = useRef({ cur: 0, total: 0, nextId, prevId });
  useEffect(() => {
    latest.current = { cur, total, nextId, prevId };
  });
  const [viewability] = useState({ itemVisiblePercentThreshold: 25 });
  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
    const first = viewableItems.find((v) => v.index !== null);
    if (first && first.index !== null) setCur(first.index);
  });

  const step = useMemo(
    () => (dir: 1 | -1) => {
      const { cur: c, total: n, nextId: nx, prevId: pv } = latest.current;
      const to = c + dir;
      if (to >= 0 && to < n) {
        setCur(to);
        list.current?.scrollToIndex({ index: to, animated: true, viewOffset: 8 });
      } else {
        const ch = dir === 1 ? nx : pv;
        if (ch) router.replace({ pathname: '/chapter/[id]', params: { id: String(ch) } });
      }
    },
    [],
  );

  // same swipe as the hadith page and the popup: left = next, right = previous
  // gesture callbacks run on touch, not during render; they read the latest position through a ref
  /* eslint-disable react-hooks/refs */
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-40, 40])
        .failOffsetY([-14, 14])
        .onEnd((e) => {
          if (e.translationX < -90) step(1);
          else if (e.translationX > 90) step(-1);
        }),
    [step],
  );
  /* eslint-enable react-hooks/refs */

  if (error) return <ErrorView error={error} onRetry={reload} />;
  if (loading || !data) return <Loading />;
  const { rows, siblings, chapter } = data;

  const pos = siblings.findIndex((c) => c.id === chapterId);
  const prev = pos > 0 ? siblings[pos - 1] : null;
  const next = pos >= 0 && pos < siblings.length - 1 ? siblings[pos + 1] : null;
  const first = rows[0];

  return (
    <GestureDetector gesture={swipe}>
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: first ? first.book_title_ml : '',
          headerRight: () => (
            <Row gap={0}>
              <IconButton name="chevron-back" label="Previous hadith" disabled={cur === 0 && !prev} onPress={() => step(-1)} />
              <T variant="caption" weight="bold" color="muted">{rows.length ? `${cur + 1}/${rows.length}` : ''}</T>
              <IconButton name="chevron-forward" label="Next hadith" disabled={cur >= rows.length - 1 && !next} onPress={() => step(1)} />
            </Row>
          ),
        }}
      />
      <FlatList
        ref={list}
        viewabilityConfig={viewability}
        onViewableItemsChanged={onViewable}
        onScrollToIndexFailed={(info) => {
          // rows have different heights: scroll near the target first, then retry
          list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          setTimeout(() => list.current?.scrollToIndex({ index: info.index, animated: true, viewOffset: 8 }), 120);
        }}
        data={rows}
        keyExtractor={(h) => String(h.id)}
        ListHeaderComponent={
          <Column style={{ paddingVertical: space.xl, alignItems: 'center' }}>
            <T variant="tiny" color="gold" weight="bold">Chapter {chapter?.chapter_no ?? first?.chapter_no}</T>
            {first?.chapter_title_ar ? (
              <ArabicTitle variant="heading">{first.chapter_title_ar}</ArabicTitle>
            ) : null}
            <T variant="heading" center>{first?.chapter_title_ml}</T>
          </Column>
        }
        renderItem={({ item: h, index }) => (
          <Column>
            {index > 0 && <Divider style={{ marginTop: space.xl, marginBottom: space.xl }} />}
            <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
              <Pressable onPress={() => router.push({ pathname: '/hadith/[id]', params: { id: String(h.id) } })}>
                <T variant="caption" weight="bold" color="gold">{h.hadith_no >= 10001 ? 'Hadith' : `Hadith ${h.hadith_no}`}</T>
              </Pressable>
              <HadithActions h={h} compact />
            </Row>
            {counts[h.id] ? (
              <Pressable onPress={() => router.push({ pathname: '/hadith/[id]', params: { id: String(h.id) } })} style={{ alignSelf: 'flex-start', marginBottom: space.md }}>
                <Badge tone="gold">{`↔ Also in ${counts[h.id]} other place${counts[h.id] > 1 ? 's' : ''}`}</Badge>
              </Pressable>
            ) : null}
            <HadithBody h={h} />
          </Column>
        )}
        contentContainerStyle={{ paddingBottom: 64 }}
      />
    </View>
    </GestureDetector>
  );
}
