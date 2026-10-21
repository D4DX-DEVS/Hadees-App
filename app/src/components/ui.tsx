import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, ReactNode, Ref, useState } from 'react';
import {
  ActivityIndicator, Platform, ScrollView, ScrollViewProps, StyleProp, StyleSheet, Text, TextProps,
  TextStyle, View, ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { maxWidth, radius, shadow, space, uiFont } from '@/lib/theme';
import { AnimatedPressable } from './motion';
import { useSettings } from '@/state/settings';
import { friendlyError } from '@/lib/errors';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** UI font stack: Inter for Latin, the chosen Malayalam font for Malayalam glyphs (web); OS fallback on native. */
export function useUiFont() {
  const { fonts } = useSettings();
  return (weight: keyof typeof uiFont = 'regular') =>
    Platform.OS === 'web'
      ? `${uiFont[weight]}, ${weight === 'bold' ? fonts.mlBold : weight === 'medium' ? fonts.mlMedium : fonts.ml}, system-ui, sans-serif`
      : uiFont[weight];
}

type TProps = TextProps & {
  variant?: 'title' | 'heading' | 'body' | 'label' | 'caption' | 'tiny';
  color?: 'text' | 'muted' | 'faint' | 'accent' | 'gold' | 'danger' | 'onAccent';
  weight?: 'regular' | 'medium' | 'bold';
  center?: boolean;
};

const SIZES = { title: 28, heading: 19, body: 15, label: 14, caption: 13, tiny: 11 };

const MALAYALAM = /[\u0D00-\u0D7F]/;
/** True if any string inside `node` contains Malayalam (children may be nested / mixed with numbers). */
function hasMalayalam(node: ReactNode): boolean {
  if (typeof node === 'string') return MALAYALAM.test(node);
  if (Array.isArray(node)) return node.some(hasMalayalam);
  if (node && typeof node === 'object' && 'props' in (node as object)) return hasMalayalam((node as { props?: { children?: ReactNode } }).props?.children);
  return false;
}
export const MIN_MALAYALAM_SIZE = 16;

export function T({ variant = 'body', color = 'text', weight, center, style, ...rest }: TProps) {
  const { colors } = useSettings();
  const font = useUiFont();
  const w = weight ?? (variant === 'title' || variant === 'heading' ? 'bold' : 'regular');
  const c = { text: colors.text, muted: colors.textMuted, faint: colors.textFaint, accent: colors.accent, gold: colors.gold, danger: colors.danger, onAccent: colors.onAccent }[color];
  // Malayalam is never shown below 16 px, whatever the variant
  const ml = hasMalayalam(rest.children);
  const size = ml ? Math.max(SIZES[variant], MIN_MALAYALAM_SIZE) : SIZES[variant];
  // native has no per-glyph font stack: text containing Malayalam uses the chosen Malayalam family at the same weight
  const { fonts } = useSettings();
  const mlFamily = w === 'bold' ? fonts.mlBold : w === 'medium' ? fonts.mlMedium : fonts.ml;
  // text containing Malayalam always starts with the chosen Malayalam font (same as the hadith text), on web and native
  const family = ml ? (Platform.OS === 'web' ? `${mlFamily}, ${uiFont[w]}, system-ui, sans-serif` : mlFamily) : font(w);
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: family, fontSize: size, lineHeight: Math.round(size * (ml ? 1.55 : 1.45)), color: c },
        variant === 'title' && { letterSpacing: -0.4 },
        center && { textAlign: 'center' },
        style,
      ]}
    />
  );
}

/** Page wrapper: themed background, centred column on wide screens. */
export function Screen({
  children, scroll = true, style, contentStyle, scrollRef, ...rest
}: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>; scrollRef?: Ref<ScrollView> } & ScrollViewProps) {
  const { colors } = useSettings();
  const insets = useSafeAreaInsets();
  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: colors.bg }, style]}>{children}</View>;
  }
  return (
    <ScrollView
      ref={scrollRef}
      style={[{ flex: 1, backgroundColor: colors.bg }, style]}
      contentContainerStyle={[styles.column, { paddingBottom: insets.bottom + 48 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      {...rest}>
      {children}
    </ScrollView>
  );
}

export function Column({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.column, style]}>{children}</View>;
}

export function Card({ children, style, onPress, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean }) {
  const { colors } = useSettings();
  const [hover, setHover] = useState(false);
  const base = [
    { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg },
    padded && { padding: space.lg },
    shadow,
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <AnimatedPressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      pressScale={0.985}
      style={[base, hover && { borderColor: colors.accent }]}>
      {children}
    </AnimatedPressable>
  );
}

export function Chip({
  label, icon, active, onPress, onLongPress, style,
}: { label: string; icon?: IconName; active?: boolean; onPress?: () => void; onLongPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const { colors } = useSettings();
  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      pressScale={0.95}
      style={[
        styles.chip,
        { backgroundColor: active ? colors.accent : colors.surfaceAlt, borderColor: active ? colors.accent : colors.border },
        style,
      ]}>
      {icon && <Ionicons name={icon} size={16} color={active ? colors.onAccent : colors.textMuted} />}
      <T variant="caption" weight="medium" color={active ? 'onAccent' : 'text'} numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </T>
    </AnimatedPressable>
  );
}

export function IconButton({
  name, onPress, label, size = 22, color, filled, style, disabled,
}: { name: IconName; onPress?: () => void; label: string; size?: number; color?: string; filled?: boolean; style?: StyleProp<ViewStyle>; disabled?: boolean }) {
  const { colors } = useSettings();
  const [hover, setHover] = useState(false);
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      pressScale={0.88}
      style={[
        styles.iconBtn,
        filled && { backgroundColor: colors.accent },
        hover && !filled && { backgroundColor: colors.surfaceAlt },
        disabled && { opacity: 0.4 },
        style,
      ]}>
      <Ionicons name={name} size={size} color={color ?? (filled ? colors.onAccent : colors.textMuted)} />
    </AnimatedPressable>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <T variant="label" weight="bold" color="muted" style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 12 }}>
        {children}
      </T>
      {action}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const { colors } = useSettings();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
      {label && <T variant="caption" color="muted" style={{ marginTop: space.sm }}>{label}</T>}
    </View>
  );
}

export function Empty({ icon = 'search-outline', title, body, children }: { icon?: IconName; title: string; body?: string; children?: ReactNode }) {
  const { colors } = useSettings();
  return (
    <View style={styles.center}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
        <Ionicons name={icon} size={28} color={colors.accent} />
      </View>
      <T variant="heading" center style={{ marginTop: space.md }}>{title}</T>
      {body && <T color="muted" center style={{ marginTop: space.xs, maxWidth: 420 }}>{body}</T>}
      {children}
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = friendlyError(error);
  return (
    <Empty icon="cloud-offline-outline" title="Could not load" body={msg}>
      {onRetry && <Chip label="Try again" icon="refresh" onPress={onRetry} style={{ marginTop: space.md }} />}
    </Empty>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useSettings();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }, style]} />;
}

export function Row({ children, gap = space.sm, style, wrap }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, wrap && { flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function Badge({ children, tone = 'accent', style }: { children: ReactNode; tone?: 'accent' | 'gold' | 'muted'; style?: StyleProp<TextStyle> }) {
  const { colors } = useSettings();
  const bg = tone === 'accent' ? colors.accentSoft : tone === 'gold' ? colors.highlight : colors.surfaceAlt;
  const fg = tone === 'accent' ? 'accent' : tone === 'gold' ? 'gold' : 'muted';
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <T variant="tiny" weight="bold" color={fg} style={style}>{children}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  column: { width: '100%', maxWidth, alignSelf: 'center', paddingHorizontal: space.lg },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, maxWidth: '100%',
  },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xl, marginBottom: space.sm },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 56, paddingHorizontal: space.lg },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});

/**
 * Arabic title (book / chapter names). Same font as hadith text, regular weight, size = Settings size x scale.
 * `variant` only changes the scale: title (book header), heading (chapter header), row (list rows).
 */
export function ArabicTitle({ children, variant = 'row', align }: { children: string; variant?: 'title' | 'heading' | 'row'; align?: 'left' | 'center' | 'right' }) {
  const { settings, fonts, colors } = useSettings();
  const scale = { title: 1.15, heading: 1, row: 0.75 }[variant];
  const size = Math.round(settings.arSize * scale);
  return (
    <Text
      style={{
        fontFamily: fonts.ar, fontSize: size, lineHeight: Math.round(size * 1.9), color: colors.text,
        textAlign: align ?? (variant === 'row' ? 'right' : 'center'), writingDirection: 'rtl',
      }}>
      {children}
    </Text>
  );
}
