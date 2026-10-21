import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeOutDown, SlideInDown } from 'react-native-reanimated';

import { nudgeShown, shouldNudge } from '@/lib/feedback';
import { radius, shadow, space } from '@/lib/theme';
import { useLibrary } from '@/state/library';
import { useSettings } from '@/state/settings';

import { Chip, Row, T } from './ui';

/** A rare, dismissible bottom card: "you can send feedback". Shown on Home after real use, then left alone. */
export function FeedbackNudge() {
  const { colors } = useSettings();
  const { reads } = useLibrary();
  const [show, setShow] = useState(false);
  const count = reads.length;

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      if (alive && (await shouldNudge(count))) setShow(true);
    }, 4000);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [count]);

  if (!show) return null;
  const close = (action: 'dismissed' | 'opened') => {
    nudgeShown(action);
    setShow(false);
  };
  return (
    <Animated.View entering={SlideInDown.springify().damping(16)} exiting={FadeOutDown.duration(180)} style={styles.wrap} pointerEvents="box-none">
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow]}>
        <Row gap={10} style={{ alignItems: 'flex-start' }}>
          <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <T weight="bold">Enjoying the app?</T>
            <T variant="caption" color="muted">Your ideas help us improve it. You can always find Feedback in the menu.</T>
          </View>
        </Row>
        <Row style={{ justifyContent: 'flex-end', marginTop: space.md }}>
          <Chip label="Not now" onPress={() => close('dismissed')} />
          <Chip
            label="Give feedback"
            icon="paper-plane-outline"
            active
            onPress={() => {
              close('opened');
              router.push('/feedback');
            }}
          />
        </Row>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, bottom: 150, alignItems: 'center' },
  card: { width: '100%', maxWidth: 520, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.md },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
