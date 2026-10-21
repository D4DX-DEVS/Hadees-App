import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Pressable, ScrollView, View } from 'react-native';

import { BookmarkNote } from '@/components/bookmark-note';
import { ArabicText, HadithActions, HadithBody, MalayalamText } from '@/components/hadith';
import { useHadithSheet } from '@/components/hadith-sheet';
import { Appear } from '@/components/motion';
import { Badge, Card, Chip, ErrorView, Loading, Row, Screen, SectionTitle, T } from '@/components/ui';
import { api } from '@/lib/api';
import { citation, stripNarrator } from '@/lib/text';
import { space } from '@/lib/theme';
import { CrossRef, snap } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { useLibrary } from '@/state/library';
import { useSettings } from '@/state/settings';

const REL: Record<CrossRef['relation'], string> = { duplicate: 'Same hadith', variant: 'Another narration', partial: 'Partial match' };

export default function HadithScreen() {
  const { id, q } = useLocalSearchParams<{ id: string; q?: string }>();
  const hid = Number(id);
  const { colors, settings } = useSettings();
  const { addRead } = useLibrary();
  const { open: openSheet } = useHadithSheet();
  const scroller = useRef<ScrollView>(null);
  const [pos, setPos] = useState<{ variants?: number; refs?: number }>({});
  const { data: h, error, reload } = useLoad(() => api.hadith(hid), [hid]);
  const variants = useLoad(() => api.variants(hid), [hid]).data ?? [];
  const refs = useLoad(() => api.crossRefs(hid), [hid]).data ?? [];
  const nav = useLoad(() => (h ? api.neighbours(h) : Promise.resolve({} as { prev?: number; next?: number })), [h?.id]).data ?? ({} as { prev?: number; next?: number });

  // swipe left = next hadith, swipe right = previous (horizontal only, so vertical scrolling is untouched)
  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-40, 40])
        .failOffsetY([-14, 14])
        .onEnd((e) => {
          const to = e.translationX < -90 ? nav.next : e.translationX > 90 ? nav.prev : undefined;
          if (to) router.replace({ pathname: '/hadith/[id]', params: { id: String(to) } });
        }),
    [nav.next, nav.prev],
  );

  // record in reading history once the hadith is shown
  useEffect(() => {
    if (h) addRead(snap(h));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h?.id]);

  if (error) return <ErrorView error={error} onRetry={reload} />;
  if (!h) return <Loading />;

  const go = (to?: number) => to && router.replace({ pathname: '/hadith/[id]', params: { id: String(to) } });

  return (
    <GestureDetector gesture={swipe}>
    <View style={{ flex: 1 }}>
    <Screen scrollRef={scroller}>
      <Stack.Screen options={{ title: `Hadith ${h.hadith_label && h.hadith_no >= 10001 ? '' : h.hadith_no}`, headerRight: () => <HadithActions h={h} compact /> }} />

      <View style={{ marginTop: space.lg, gap: 2 }}>
        <T variant="caption" color="faint">{`Volume ${h.volume_id}`}</T>
        <Pressable onPress={() => router.push({ pathname: '/book/[id]', params: { id: String(h.book_id) } })}>
          <T variant="label" color="accent" weight="bold">{`Book ${h.book_no}: ${h.book_title_ml}`}</T>
        </Pressable>
        {h.chapter_title_ml ? (
          <Pressable onPress={() => h.chapter_id && router.push({ pathname: '/chapter/[id]', params: { id: String(h.chapter_id) } })}>
            <T variant="caption" color="accent" numberOfLines={2}>{`Chapter ${h.chapter_no}: ${h.chapter_title_ml}`}</T>
          </Pressable>
        ) : null}
      </View>

      {(variants.length > 0 || refs.length > 0) && (
        <Row wrap style={{ marginTop: space.lg }}>
          {variants.length > 0 && (
            <Chip icon="git-branch-outline" label={`${variants.length} other narration${variants.length > 1 ? 's' : ''}`} onPress={() => scroller.current?.scrollTo({ y: Math.max(0, (pos.variants ?? 0) - 12), animated: true })} />
          )}
          {refs.length > 0 && (
            <Chip icon="swap-horizontal" label={`${refs.length} cross reference${refs.length > 1 ? 's' : ''}`} onPress={() => scroller.current?.scrollTo({ y: Math.max(0, (pos.refs ?? 0) - 12), animated: true })} />
          )}
        </Row>
      )}

      <Card style={{ marginTop: space.xl }}>
        <HadithBody h={h} query={q} />
      </Card>
      <BookmarkNote id={h.id} />

      {variants.length > 0 && (
        <View onLayout={(e) => {
            const y = e.nativeEvent.layout.y;
            setPos((p) => ({ ...p, variants: y }));
          }}>
          <SectionTitle>Other narrations ({variants.length})</SectionTitle>
          {variants.map((v) => (
            <Card key={v.id} style={{ marginBottom: space.md, gap: space.md }}>
              {settings.showArabic && v.arabic_text ? <ArabicText text={v.arabic_text} /> : null}
              {v.malayalam_text ? <MalayalamText text={v.malayalam_text} /> : null}
            </Card>
          ))}
        </View>
      )}

      {refs.length > 0 && (
        <View onLayout={(e) => {
            const y = e.nativeEvent.layout.y;
            setPos((p) => ({ ...p, refs: y }));
          }}>
          <SectionTitle>Cross references ({refs.length})</SectionTitle>
          {refs.map((r, i) => (
            <Appear key={r.hadith_id} index={i}>
            <Card onPress={() => openSheet(r.hadith_id)} style={{ marginBottom: space.sm }}>
              <Row gap={6} style={{ marginBottom: 6 }}>
                <Badge tone={r.relation === 'duplicate' ? 'accent' : 'gold'}>{REL[r.relation]}</Badge>
                {!r.cross_book ? <Badge tone="muted">Same book</Badge> : null}
              </Row>
              <T variant="caption" color="muted">
                {citation({ volume_id: r.volume_id, book_title_ml: r.book_title, chapter_no: r.chapter_no, hadith_no: r.hadith_no, hadith_label: r.hadith_label }, true)}
              </T>
              <T variant="label" weight="bold">{r.chapter_title ?? r.book_title}</T>
              <View style={{ marginTop: 6 }}>
                <MalayalamText text={stripNarrator(r.snippet, r.narrator_ml)} numberOfLines={4} />
              </View>
              <T variant="caption" weight="bold" color="muted" style={{ marginTop: 6 }}>{r.narrator_ml ?? ''}</T>
              <Row gap={8} style={{ marginTop: 4 }}>
                <Pressable hitSlop={8} style={{ paddingVertical: 6 }} onPress={() => router.push({ pathname: '/book/[id]', params: { id: String(r.book_id) } })}>
                  <T variant="caption" color="accent" weight="medium">Open book</T>
                </Pressable>
                {r.chapter_id ? (
                  <Pressable hitSlop={8} style={{ paddingVertical: 6 }} onPress={() => router.push({ pathname: '/chapter/[id]', params: { id: String(r.chapter_id!) } })}>
                    <T variant="caption" color="accent" weight="medium">· Open chapter</T>
                  </Pressable>
                ) : null}
              </Row>
            </Card>
            </Appear>
          ))}
        </View>
      )}

      <Row style={{ justifyContent: 'space-between', marginTop: space.xl }}>
        <Pressable disabled={!nav.prev} onPress={() => go(nav.prev)} style={{ opacity: nav.prev ? 1 : 0.3 }}>
          <Row gap={4}><Ionicons name="chevron-back" size={16} color={colors.accent} /><T color="accent" weight="medium">Previous</T></Row>
        </Pressable>
        <Pressable disabled={!nav.next} onPress={() => go(nav.next)} style={{ opacity: nav.next ? 1 : 0.3 }}>
          <Row gap={4}><T color="accent" weight="medium">Next</T><Ionicons name="chevron-forward" size={16} color={colors.accent} /></Row>
        </Pressable>
      </Row>

      {h.page_start ? (
        <T variant="tiny" color="faint" center style={{ marginTop: space.xl }}>
          Printed page {h.page_start}{h.page_end && h.page_end !== h.page_start ? `–${h.page_end}` : ''}
        </T>
      ) : null}
    </Screen>
    </View>
    </GestureDetector>
  );
}
