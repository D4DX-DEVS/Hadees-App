import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useLibrary } from '@/state/library';
import { useSettings } from '@/state/settings';

import { Appear, fade, slideInLeft } from './motion';
import { IconButton, T } from './ui';

const ITEMS = [
  { href: '/', label: 'Ask & Library', icon: 'sparkles-outline' },
  { href: '/saved', label: 'Saved', icon: 'bookmark-outline' },
  { href: '/offline', label: 'Offline books', icon: 'download-outline' },
  { href: '/settings', label: 'Settings', icon: 'text-outline' },
  { href: '/feedback', label: 'Feedback', icon: 'chatbubble-ellipses-outline' },
] as const;

/** Wide web windows get a permanent sidebar instead of the slide-in menu. */
export function useIsWide() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= 1000;
}

export const SIDEBAR_WIDTH = 300;

/** The menu contents. `onClose` is set inside the slide-in menu; the permanent sidebar has none. */
export function MenuPanel({ onClose }: { onClose?: () => void }) {
  const { colors } = useSettings();
  const { bookmarks, searches, removeSearch, clearSearches } = useLibrary();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const [articlesOpen, setArticlesOpen] = useState(false);
  const articles = useLoad(() => api.articles(), []).data ?? [];

  const go = (href: (typeof ITEMS)[number]['href']) => {
    onClose?.();
    if (href !== path) router.navigate(href);
  };

  // open the home screen with a recent question / a fresh chat (n makes each tap a new event)
  const openHome = (q?: string, mode?: 'ask' | 'search') => {
    onClose?.();
    router.navigate({ pathname: '/', params: { n: String(Date.now()), ...(q ? { q, mode } : {}) } });
  };

  return (
    <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border, paddingTop: (onClose ? insets.top : 0) + space.md }]}>
      <View style={styles.head}>
        <View style={[styles.logo, { backgroundColor: colors.accent }]}>
          <T variant="label" weight="bold" color="onAccent">ح</T>
        </View>
        <View style={{ flex: 1 }}>
          <T weight="bold">Hadees Vijnanakosham</T>
          <T variant="tiny" color="faint">ഹദീസ് വിജ്ഞാനകോശം</T>
        </View>
        {onClose ? <IconButton name="close" label="Close menu" size={20} onPress={onClose} /> : null}
      </View>
      <Pressable
        onPress={() => openHome()}
        style={({ pressed }) => [styles.item, styles.newChat, { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' }]}>
        <Ionicons name="create-outline" size={20} color={colors.text} />
        <T weight="medium" style={{ flex: 1 }}>New chat</T>
      </Pressable>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + space.lg }} showsVerticalScrollIndicator={false}>
        {ITEMS.map((it, idx) => {
          const active = it.href === path;
          return (
            <Appear key={it.href} index={idx + 1}>
              <Pressable
                onPress={() => go(it.href)}
                accessibilityRole="menuitem"
                style={({ pressed }) => [styles.item, { backgroundColor: active ? colors.accentSoft : pressed ? colors.surfaceAlt : 'transparent' }]}>
                <Ionicons name={it.icon} size={20} color={active ? colors.accent : colors.textMuted} />
                <T weight={active ? 'bold' : 'medium'} color={active ? 'accent' : 'text'} style={{ flex: 1 }}>{it.label}</T>
                {it.href === '/saved' && bookmarks.length > 0 ? <T variant="caption" color="muted">{bookmarks.length}</T> : null}
              </Pressable>
            </Appear>
          );
        })}
        {articles.length > 0 && (
          <>
            <Pressable
              onPress={() => setArticlesOpen((v) => !v)}
              accessibilityRole="menuitem"
              accessibilityState={{ expanded: articlesOpen }}
              style={({ pressed }) => [styles.item, { backgroundColor: pressed ? colors.surfaceAlt : 'transparent' }]}>
              <Ionicons name="document-text-outline" size={20} color={colors.textMuted} />
              <T weight="medium" style={{ flex: 1 }}>Articles</T>
              <T variant="caption" color="muted">{articles.length}</T>
              <Ionicons name={articlesOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textFaint} />
            </Pressable>
            {articlesOpen &&
              articles.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => {
                    onClose?.();
                    router.push({ pathname: '/article/[id]', params: { id: String(a.id) } });
                  }}
                  style={({ pressed, hovered }: any) => [styles.sub, (pressed || hovered) && { backgroundColor: colors.surfaceAlt }]}>
                  <T variant="caption" numberOfLines={2}>{a.title_ml}</T>
                </Pressable>
              ))}
          </>
        )}
        <View style={styles.recentHead}>
          <T variant="tiny" color="faint" weight="bold" style={{ letterSpacing: 0.6 }}>RECENT</T>
          {searches.length > 0 && (
            <Pressable onPress={clearSearches} hitSlop={8}>
              <T variant="tiny" color="accent" weight="medium">Clear</T>
            </Pressable>
          )}
        </View>
        {searches.length === 0 ? (
          <T variant="caption" color="faint" style={{ paddingHorizontal: 12 }}>Your questions and searches will appear here.</T>
        ) : (
          searches.slice(0, 30).map((e) => (
            <Pressable
              key={e.q}
              onPress={() => openHome(e.q, e.mode)}
              style={({ pressed, hovered }: any) => [styles.recent, (pressed || hovered) && { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name={e.mode === 'ask' ? 'sparkles-outline' : 'search-outline'} size={16} color={colors.textFaint} />
              <T variant="caption" numberOfLines={1} style={{ flex: 1 }}>{e.q}</T>
              <IconButton name="close" label="Remove" size={16} onPress={() => removeSearch(e.q)} style={{ width: 28, height: 28 }} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

/** Permanent left column for wide web windows. */
export function Sidebar() {
  const { colors } = useSettings();
  return (
    <View style={{ width: SIDEBAR_WIDTH, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border, backgroundColor: colors.surface }}>
      <MenuPanel />
    </View>
  );
}

/** Hamburger button + slide-in menu (phones and narrow windows). */
export function MenuButton() {
  const { colors } = useSettings();
  const wide = useIsWide();
  const [open, setOpen] = useState(false);
  if (wide) return null;
  return (
    <>
      <IconButton name="menu" label="Open menu" size={22} color={colors.text} onPress={() => setOpen(true)} />
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Animated.View entering={fade} style={{ flex: 1 }}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Animated.View entering={slideInLeft} style={{ height: '100%', width: '82%', maxWidth: 320 }}>
              <Pressable onPress={() => {}} style={{ flex: 1 }}>
                <MenuPanel onClose={() => setOpen(false)} />
              </Pressable>
            </Animated.View>
          </Pressable>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  panel: { flex: 1, width: '100%', paddingHorizontal: space.md, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: space.lg, paddingLeft: 4 },
  logo: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  newChat: { borderWidth: StyleSheet.hairlineWidth, marginBottom: space.sm },
  recentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, marginTop: space.lg, marginBottom: 6 },
  sub: { paddingVertical: 9, paddingLeft: 44, paddingRight: 12, borderRadius: radius.md },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingLeft: 12, paddingRight: 4, borderRadius: radius.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 12, borderRadius: radius.md },
});
