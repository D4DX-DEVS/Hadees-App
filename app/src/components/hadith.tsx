import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, View } from 'react-native';
import Animated, { LinearTransition, ReduceMotion } from 'react-native-reanimated';

import { api } from '@/lib/api';
import { sourceList } from '@/lib/sources';
import { citation, hadithNo, shareText, isArabic, previewText, stripHarakat, stripNarrator } from '@/lib/text';
import { malayalamFonts, radius, space } from '@/lib/theme';
import { Hadith, HadithSnap, snap } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { useLibrary } from '@/state/library';
import { useSettings } from '@/state/settings';

import { NarratorName } from './narrator';
import { SourceChips } from './sources';
import { enter, Pop } from './motion';
import { ArabicText, Highlighted, MalayalamText } from './reading-text';
import { useShareCard } from './share-card';
import { Badge, Card, Chip, IconButton, Loading, Row, T } from './ui';

export { ArabicText, Highlighted, MalayalamText } from './reading-text';

export const refLine = (h: { volume_id: number; book_title_ml: string; chapter_title_ml?: string | null }) =>
  `Volume ${h.volume_id} · ${h.book_title_ml}`;

/** Hadith number: plain gold text, no box. plate = header label, chip = list-card number, pill = dense reader label. */
export function NumberMark({ h, variant = 'chip' }: { h: { hadith_no: number; hadith_label?: string | null }; variant?: 'plate' | 'chip' | 'pill' }) {
  const n = hadithNo(h);
  if (variant === 'plate') return <T variant="label" weight="bold" color="gold">{n === '•' ? 'Hadith' : `Hadith ${n}`}</T>;
  if (variant === 'pill') return <T variant="caption" weight="bold" color="gold">{n === '•' ? 'Hadith' : `Hadith ${n}`}</T>;
  return (
    <T weight="bold" color="gold" style={{ minWidth: 34, fontSize: n.length > 3 ? 14 : 17 }}>{n}</T>
  );
}

/**
 * Shared pieces: EVERY hadith in the app (list card, chapter reader, hadith page, popup, cross references,
 * variants) is built from these, so fonts, sizes, spacing, alignment and wording are identical everywhere.
 */

/** Chapter title (bold). `full` adds the Vol / Book / Ch. / Hadith line above it. */
export function HadithHeading({ h, full }: { h: HadithSnap & Partial<Hadith>; full?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      {full ? <T variant="caption" color="muted">{citation(h, true)}</T> : null}
      <T variant="label" weight="bold">{h.chapter_title_ml ?? h.book_title_ml}</T>
    </View>
  );
}

/** "narrator · Hadith N" line shown under collapsed text. */
export function NarratorLine({ h }: { h: HadithSnap & Partial<Hadith> }) {
  const { settings } = useSettings();
  const no = hadithNo(h) === '•' ? null : `Hadith ${hadithNo(h)}`;
  if (!(settings.showNarrator && h.narrator_ml) && !no) return null;
  return (
    <T variant="caption" weight="bold" color="muted" style={{ marginTop: 6 }}>
      {settings.showNarrator ? h.narrator_ml : ''}
      {no ? <T variant="caption" weight="bold" color="gold">{settings.showNarrator && h.narrator_ml ? `   ·   ${no}` : no}</T> : null}
    </T>
  );
}

/** Arabic (optionally behind a toggle) + narrator + Malayalam. The one reading layout. */
export function HadithText({
  h, query, collapsible = true, linkNarrator = true,
}: { h: Hadith; query?: string; collapsible?: boolean; linkNarrator?: boolean }) {
  const { settings } = useSettings();
  const collapsed = collapsible && settings.arabicCollapsed;
  const [arOpen, setArOpen] = useState(!collapsed);
  const mlText = h.malayalam_text ?? '';
  const body = settings.showNarrator ? stripNarrator(mlText, h.narrator_ml ?? '') : mlText;

  const arabic = settings.showArabic && h.arabic_text ? (
    collapsed ? (
      <View style={{ gap: space.sm }}>
        <Chip label={arOpen ? 'Hide Arabic' : 'Show Arabic'} icon="language" active={arOpen} onPress={() => setArOpen((v) => !v)} style={{ alignSelf: 'flex-start' }} />
        {arOpen ? <ArabicText text={h.arabic_text} query={query} /> : null}
      </View>
    ) : (
      <ArabicText text={h.arabic_text} query={query} />
    )
  ) : null;
  const ml = (
    <View style={{ gap: 6 }}>
      {settings.showNarrator && h.narrator_ml ? (linkNarrator ? <NarratorName name={h.narrator_ml} /> : <T variant="label" weight="bold" color="accent">{h.narrator_ml}</T>) : null}
      <MalayalamText text={body} query={query} />
    </View>
  );
  const arabicFirst = settings.arabicFirst && !collapsed;
  return (
    <View style={{ gap: space.md }}>
      {arabicFirst ? arabic : null}
      {ml}
      {!arabicFirst ? arabic : null}
    </View>
  );
}

/** Source chips + grading note + unnumbered label. */
export function HadithMeta({ h }: { h: Hadith }) {
  const { colors } = useSettings();
  return (
    <View style={{ gap: space.sm }}>
      <SourceChips codes={h.source_codes_ml} />
      {h.hadith_label && h.hadith_no >= 10001 ? <Badge tone="muted">{h.hadith_label}</Badge> : null}
      {h.grading_note_ml ? (
        <View style={[styles.note, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
          <T variant="caption" color="muted" style={{ flex: 1 }}>{h.grading_note_ml}</T>
        </View>
      ) : null}
    </View>
  );
}

/** Full hadith body used by the hadith page and the chapter reader. */
export function HadithBody({ h, query }: { h: Hadith; query?: string }) {
  return (
    <View style={{ gap: space.md }}>
      <HadithText h={h} query={query} />
      <HadithMeta h={h} />
    </View>
  );
}

/** Whole-sentence preview for collapsed cards. Same fonts/sizes as full text, just limited. */
export function HadithPreview({ h, query }: { h: HadithSnap & Partial<Hadith>; query?: string }) {
  const { settings, colors } = useSettings();
  const body = settings.showNarrator ? stripNarrator(h.malayalam_text, h.narrator_ml) : h.malayalam_text;
  const pv = previewText(body, query);
  const arabicSearch = !!query && isArabic(query) && !!h.arabic_text;
  return {
    more: pv.more,
    node: (
      <View style={{ gap: 6 }}>
        {arabicSearch ? <ArabicText text={stripHarakat(h.arabic_text!)} query={query} numberOfLines={2} /> : null}
        <Highlighted
          text={pv.text}
          query={query}
          numberOfLines={5}
          style={{
            fontFamily: malayalamFonts.find((f) => f.key === settings.mlFont)?.regular, fontSize: Math.max(16, settings.mlSize),
            lineHeight: Math.round(Math.max(16, settings.mlSize) * settings.lineHeight), color: colors.text, textAlign: settings.mlAlign,
          }}
        />
      </View>
    ),
  };
}

/**
 * Result card that expands in place (search, saved, history, AI references).
 * Collapsed: chapter title, preview, "narrator · Hadith N", More, sources. Expanded: HadithText + meta + actions.
 */
export function HadithListCard({
  h, query, index = 0, refCount = 0,
}: { h: HadithSnap & Partial<Hadith>; query?: string; index?: number; refCount?: number }) {
  const { colors } = useSettings();
  const [open, setOpen] = useState(false);
  const needFull = open && !h.arabic_text;
  const fetched = useLoad(() => (needFull ? api.hadith(h.id) : Promise.resolve(null)), [needFull, h.id]).data;
  const full = (h.arabic_text ? (h as Hadith) : fetched) as Hadith | null;
  const refs = useLoad(() => (open ? api.crossRefs(h.id) : Promise.resolve(null)), [open, h.id]).data;
  const links = refs?.length ?? refCount;
  const toggle = () => setOpen((v) => !v);
  const pv = HadithPreview({ h, query });

  return (
    <Animated.View entering={enter(index)} layout={LinearTransition.duration(220).reduceMotion(ReduceMotion.System)} style={{ marginBottom: space.md }}>
      <Card style={open ? { borderColor: colors.accent } : undefined}>
        <Pressable onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.cardHead}>
          <HadithHeading h={h} full={open} />
          <View style={[styles.expandBtn, { backgroundColor: open ? colors.accent : colors.accentSoft }]}>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={open ? colors.onAccent : colors.accent} />
          </View>
        </Pressable>

        {!open ? (
          <Pressable onPress={toggle} style={{ marginTop: 6 }}>
            {pv.node}
            <NarratorLine h={h} />
            {pv.more ? (
              <Row gap={4} style={{ marginTop: 6 }}>
                <T variant="label" weight="bold" color="accent">More</T>
                <Ionicons name="chevron-down" size={16} color={colors.accent} />
              </Row>
            ) : null}
          </Pressable>
        ) : !full ? (
          <View style={{ paddingVertical: space.lg }}><Loading /></View>
        ) : (
          <View style={{ marginTop: space.sm, gap: space.md }}>
            <HadithText h={full} query={query} />
            <HadithMeta h={full} />
            {links > 0 ? (
              <Pressable
                onPress={() => router.push({ pathname: '/hadith/[id]', params: { id: String(h.id) } })}
                style={[styles.linkRow, { backgroundColor: colors.goldSoft, borderColor: colors.gold + '55' }]}>
                <T variant="label" weight="bold" color="gold" style={{ flex: 1 }}>{`↔ Same hadith in ${links} other place${links > 1 ? 's' : ''}`}</T>
                <Ionicons name="chevron-forward" size={16} color={colors.gold} />
              </Pressable>
            ) : null}
            <Row style={{ justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: space.sm }}>
              <Chip icon="open-outline" label="Open full page" onPress={() => router.push({ pathname: '/hadith/[id]', params: { id: String(h.id), q: query ?? '' } })} />
              <HadithActions h={full} compact />
            </Row>
            <Pressable onPress={toggle} style={{ alignSelf: 'center' }}>
              <Row gap={4}>
                <T variant="label" weight="bold" color="accent">Less</T>
                <Ionicons name="chevron-up" size={16} color={colors.accent} />
              </Row>
            </Pressable>
          </View>
        )}

        {!open ? (
          <Row style={[styles.cardFoot, { borderTopColor: colors.border }]}>
            <T variant="caption" color="muted" numberOfLines={1} style={{ flex: 1, fontSize: 12 }}>{sourceList(h.source_codes_ml)}</T>
            {links > 0 ? <Badge tone="gold">{`↔ ${links}`}</Badge> : null}
          </Row>
        ) : null}
      </Card>
    </Animated.View>
  );
}

/** Bookmark / copy / share row for a full hadith. */
export function HadithActions({ h, compact }: { h: Hadith; compact?: boolean }) {
  const { isBookmarked, toggleBookmark } = useLibrary();
  const { colors } = useSettings();
  const saved = isBookmarked(h.id);
  const text = shareText(h);
  const card = useShareCard();

  return (
    <Row gap={compact ? 0 : 4}>
      <Pop on={saved}>
        <IconButton
          name={saved ? 'bookmark' : 'bookmark-outline'}
          color={saved ? colors.accent : undefined}
          label={saved ? 'Remove bookmark' : 'Bookmark'}
          onPress={() => {
            toggleBookmark(snap(h));
            if (Platform.OS !== 'web') Haptics.selectionAsync();
          }}
        />
      </Pop>
      <IconButton name="copy-outline" label="Copy" onPress={() => Clipboard.setStringAsync(text)} />
      <IconButton name="image-outline" label="Share as image" onPress={() => card.open(h)} />
      <IconButton
        name="share-outline"
        label="Share"
        onPress={() => (Platform.OS === 'web' && !(navigator as any).share ? Clipboard.setStringAsync(text) : Share.share({ message: text }))}
      />
    </Row>
  );
}


const styles = StyleSheet.create({
  plate: { width: 58, height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 1 },
  chipMark: { minWidth: 40, height: 40, paddingHorizontal: 6, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pill: { height: 28, paddingHorizontal: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  expandBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardFoot: { marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: radius.md, padding: 12 },
  note: { flexDirection: 'row', gap: 6, padding: space.sm, borderRadius: radius.md, marginTop: space.sm, alignItems: 'flex-start' },
});
