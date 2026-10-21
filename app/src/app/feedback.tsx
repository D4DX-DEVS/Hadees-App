import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Appear, AnimatedPressable } from '@/components/motion';
import { Card, Chip, Row, Screen, T, useUiFont } from '@/components/ui';
import { feedbackSent, FeedbackKind, sendFeedback } from '@/lib/feedback';
import { radius, space } from '@/lib/theme';
import { useSettings } from '@/state/settings';
import { friendlyError } from '@/lib/errors';

const KINDS: { key: FeedbackKind; label: string; icon: keyof typeof Ionicons.glyphMap; hint: string }[] = [
  { key: 'idea', label: 'Suggestion', icon: 'bulb-outline', hint: 'What would make the app better for you?' },
  { key: 'problem', label: 'Problem', icon: 'bug-outline', hint: 'What went wrong? Which screen were you on?' },
  { key: 'text', label: 'Mistake in text', icon: 'create-outline', hint: 'Which book, chapter and hadith number? What is wrong?' },
  { key: 'praise', label: 'Praise', icon: 'heart-outline', hint: 'Tell us what you like.' },
];

export default function FeedbackScreen() {
  const { colors } = useSettings();
  const font = useUiFont();
  const [kind, setKind] = useState<FeedbackKind>('idea');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [state, setState] = useState<'edit' | 'sending' | 'done'>('edit');
  const [error, setError] = useState('');
  const hint = KINDS.find((k) => k.key === kind)!.hint;
  const can = message.trim().length >= 3 && state !== 'sending';

  async function submit() {
    if (!can) return;
    setState('sending');
    setError('');
    try {
      await sendFeedback({ kind, message, contact, page: 'feedback' });
      await feedbackSent();
      setState('done');
    } catch (e) {
      setError(friendlyError(e));
      setState('edit');
    }
  }

  if (state === 'done') {
    return (
      <Screen>
        <View style={styles.done}>
          <Animated.View entering={ZoomIn.springify().damping(12)} style={[styles.check, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="checkmark" size={40} color={colors.accent} />
          </Animated.View>
          <Appear index={1}><T variant="heading" center style={{ marginTop: space.lg }}>Thank you!</T></Appear>
          <Appear index={2}><T color="muted" center style={{ marginTop: 4 }}>Your message reached us. We read every one.</T></Appear>
          <Appear index={3}><Chip label="Back to the app" icon="arrow-back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ marginTop: space.xl, alignSelf: 'center' }} /></Appear>
        </View>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={{ paddingTop: space.md }}>
      <Appear><T variant="heading">Send feedback</T></Appear>
      <Appear index={1}><T color="muted" style={{ marginTop: 2 }}>Ideas, problems, or a mistake you found in the text — all welcome.</T></Appear>

      <Appear index={2}>
        <Row wrap style={{ marginTop: space.lg }}>
          {KINDS.map((k) => (
            <Chip key={k.key} label={k.label} icon={k.icon} active={kind === k.key} onPress={() => setKind(k.key)} />
          ))}
        </Row>
      </Appear>

      <Appear index={3}>
        <Card style={{ marginTop: space.lg, padding: space.md }}>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={hint}
            placeholderTextColor={colors.textFaint}
            multiline
            maxLength={2000}
            textAlignVertical="top"
            style={[styles.input, { color: colors.text, fontFamily: font('regular') }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
          />
          <T variant="tiny" color="faint" style={{ alignSelf: 'flex-end' }}>{message.length}/2000</T>
        </Card>
        <Card style={{ marginTop: space.md, padding: space.md }}>
          <TextInput
            value={contact}
            onChangeText={setContact}
            placeholder="Email or phone (optional, if you want a reply)"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            keyboardType="email-address"
            maxLength={200}
            style={[{ fontSize: 16, color: colors.text, fontFamily: font('regular'), paddingVertical: 4 }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
          />
        </Card>
      </Appear>

      {error ? <T color="danger" style={{ marginTop: space.md }}>{error}</T> : null}

      <AnimatedPressable
        onPress={submit}
        disabled={!can}
        accessibilityRole="button"
        pressScale={0.97}
        style={[styles.send, { backgroundColor: can ? colors.accent : colors.surfaceAlt }]}>
        <Ionicons name={state === 'sending' ? 'hourglass-outline' : 'paper-plane'} size={20} color={can ? colors.onAccent : colors.textFaint} />
        <T weight="bold" color={can ? 'onAccent' : 'faint'}>{state === 'sending' ? 'Sending…' : 'Send feedback'}</T>
      </AnimatedPressable>
      <T variant="tiny" color="faint" center style={{ marginTop: space.md }}>
        Only your message{contact.trim() ? ' and contact' : ''} is sent — nothing else about you.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 140, fontSize: 16, paddingVertical: 4 },
  send: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.pill, marginTop: space.lg },
  done: { alignItems: 'center', paddingTop: 80 },
  check: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
});
