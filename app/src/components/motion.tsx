import { ReactNode, useEffect, useRef } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  FadeIn, FadeInDown, ReduceMotion, SlideInLeft, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';

/** Micro-animation toolkit. Everything honours the OS "reduce motion" setting. */

const AP = Animated.createAnimatedComponent(Pressable);

/** Pressable that dips (scale + fade) while pressed and springs back. `style` must be a plain style, not a function. */
export function AnimatedPressable({
  pressScale = 0.97, style, onPressIn, onPressOut, ...rest
}: Omit<PressableProps, 'style'> & { pressScale?: number; style?: StyleProp<ViewStyle> }) {
  const p = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - pressScale) * p.value }],
    opacity: 1 - 0.1 * p.value,
  }));
  return (
    <AP
      {...rest}
      onPressIn={(e) => {
        p.value = withTiming(1, { duration: 80 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        p.value = withSpring(0, { damping: 14, stiffness: 280, reduceMotion: ReduceMotion.System });
        onPressOut?.(e);
      }}
      style={[style, anim]}
    />
  );
}

/** Staggered rise-in for list items (index capped so long lists don't wait). */
export const enter = (i = 0) => FadeInDown.delay(Math.min(i, 8) * 45).duration(280).reduceMotion(ReduceMotion.System);
export const fade = FadeIn.duration(220).reduceMotion(ReduceMotion.System);
export const slideInLeft = SlideInLeft.duration(230).reduceMotion(ReduceMotion.System);

/** Wrapper that fades/rises its content in on mount. */
export function Appear({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  return <Animated.View entering={enter(index)} style={style}>{children}</Animated.View>;
}

/** Little pop when `on` flips to true (e.g. bookmark saved). */
export function Pop({ on, children }: { on: boolean; children: ReactNode }) {
  const s = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (on) s.value = withSequence(withTiming(1.35, { duration: 110 }), withSpring(1, { damping: 7, stiffness: 240 }));
  }, [on, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={a}>{children}</Animated.View>;
}

/** Three softly pulsing dots ("thinking"). */
export function ThinkingDots({ color }: { color: string }) {
  return (
    <Animated.View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', height: 20 }}>
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 160} color={color} />
      ))}
    </Animated.View>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  const v = useSharedValue(0.25);
  useEffect(() => {
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 420 }), withTiming(0.25, { duration: 420 })), -1));
  }, [delay, v]);
  const a = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.8 + 0.3 * v.value }] }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }, a]} />;
}

/** Pulsing placeholder block for loading lists. */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const v = useSharedValue(0.5);
  useEffect(() => {
    v.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.5, { duration: 700 })), -1);
  }, [v]);
  const a = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[style, a]} />;
}
