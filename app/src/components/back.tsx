import { router } from 'expo-router';

import { useSettings } from '@/state/settings';

import { IconButton } from './ui';

/** Back button that always works: goes back if there is history (even after a deep link / refresh), else to Home. */
export function BackButton() {
  const { colors } = useSettings();
  return (
    <IconButton
      name="chevron-back"
      label="Back"
      size={26}
      color={colors.text}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}
