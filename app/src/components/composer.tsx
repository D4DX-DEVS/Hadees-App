import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { radius, shadow, space } from '@/lib/theme';
import { useSettings } from '@/state/settings';

import { AnimatedPressable } from './motion';
import { T, useUiFont } from './ui';

export type Mode = 'search' | 'ask';

/** Chat-style "ask anything" input with a search / AI mode switch. */
export function Composer({
  onSubmit, mode, onMode, aiEnabled, busy, autoFocus, placeholder,
}: {
  onSubmit: (q: string) => void; mode: Mode; onMode: (m: Mode) => void; aiEnabled: boolean; busy?: boolean;
  autoFocus?: boolean; placeholder?: string;
}) {
  const { colors } = useSettings();
  const font = useUiFont();
  const [q, setQ] = useState('');
  const can = q.trim().length > 0 && !busy;

  // sliding pill behind the active mode
  const pos = useRef<Record<Mode, { x: number; w: number }>>({ search: { x: 0, w: 0 }, ask: { x: 0, w: 0 } });
  const left = useSharedValue(0);
  const width = useSharedValue(0);
  const target = (m: Mode) => {
    left.value = withSpring(pos.current[m].x, { damping: 18, stiffness: 220 });
    width.value = withSpring(pos.current[m].w, { damping: 18, stiffness: 220 });
  };
  const place = (m: Mode, x: number, w: number) => {
    pos.current[m] = { x, w };
    if (m === mode) {
      left.value = x;
      width.value = w;
    }
  };
  useEffect(() => {
    target(mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  const indicator = useAnimatedStyle(() => ({ left: left.value, width: width.value }));

  const submit = () => {
    if (!can) return;
    onSubmit(q.trim());
    setQ('');
  };

  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }, shadow]}>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder={placeholder ?? (mode === 'ask' ? 'Ask anything about the hadith…' : 'Search the library: a word, narrator or Arabic phrase…')}
        placeholderTextColor={colors.textFaint}
        autoFocus={autoFocus}
        multiline
        submitBehavior="submit"
        onSubmitEditing={submit}
        onKeyPress={(e: any) => {
          // web: Enter sends, Shift+Enter = newline
          if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
            e.preventDefault?.();
            submit();
          }
        }}
        returnKeyType={mode === 'ask' ? 'send' : 'search'}
        style={[
          styles.input,
          { color: colors.text, fontFamily: font('regular') },
          Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
        ]}
      />
      <View style={styles.bar}>
        <View style={[styles.segment, { backgroundColor: colors.surfaceAlt }]}>
          <Animated.View pointerEvents="none" style={[styles.indicator, { backgroundColor: colors.surface }, indicator]} />
          <Seg active={mode === 'search'} icon="library" label="Library" onPress={() => onMode('search')} onLayout={(x, w) => place('search', x, w)} />
          <Seg active={mode === 'ask'} icon="sparkles" label="Ask AI" onPress={() => onMode('ask')} disabled={!aiEnabled} onLayout={(x, w) => place('ask', x, w)} />
        </View>
        <AnimatedPressable
          onPress={submit}
          disabled={!can}
          accessibilityLabel="Send"
          pressScale={0.88}
          style={[styles.send, { backgroundColor: can ? colors.accent : colors.surfaceAlt }]}>
          <Ionicons name={busy ? 'hourglass-outline' : 'arrow-up'} size={20} color={can ? colors.onAccent : colors.textFaint} />
        </AnimatedPressable>
      </View>
    </View>
  );
}

function Seg({ active, icon, label, onPress, disabled, onLayout }: { active: boolean; icon: any; label: string; onPress: () => void; disabled?: boolean; onLayout?: (x: number, w: number) => void }) {
  const { colors } = useSettings();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="tab"
      accessibilityState={{ selected: active, disabled }}
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.x, e.nativeEvent.layout.width)}
      style={[styles.seg, disabled && { opacity: 0.4 }]}>
      <Ionicons name={icon} size={16} color={active ? colors.accent : colors.textMuted} />
      <T variant="caption" weight="medium" color={active ? 'text' : 'muted'}>{label}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, paddingTop: space.md, paddingHorizontal: space.md, paddingBottom: space.sm },
  input: { fontSize: 16, minHeight: 44, maxHeight: 160, paddingHorizontal: 6, paddingVertical: 4, textAlignVertical: 'top' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs },
  segment: { flexDirection: 'row', borderRadius: radius.pill, padding: 3 },
  indicator: { position: 'absolute', top: 3, bottom: 3, borderRadius: radius.pill },
  seg: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
