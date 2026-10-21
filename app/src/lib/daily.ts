import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from './api';
import { stripNarrator } from './text';

/**
 * Optional daily hadith reminder (phones only, off by default).
 * Local notifications cannot fetch text at fire time, so the next DAYS days are scheduled in advance,
 * each with its own hadith, and the schedule is refreshed every time the app opens.
 */
export const dailySupported = Platform.OS !== 'web';
export type DailyPrefs = { enabled: boolean; hour: number; minute: number };
const KEY = 'hv.daily.v1';
const DAYS = 14;
const DEFAULT: DailyPrefs = { enabled: false, hour: 7, minute: 0 };

export async function loadDaily(): Promise<DailyPrefs> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v ? { ...DEFAULT, ...JSON.parse(v) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

/** show notifications as a banner while the app is open too, and open the hadith when one is tapped */
export function setupNotifications(onOpen: (hadithId: number) => void) {
  if (!dailySupported) return () => {};
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    const id = Number((r.notification.request.content.data as { hadithId?: number })?.hadithId);
    if (id) onOpen(id);
  });
  return () => sub.remove();
}

function clip(t: string, max = 170) {
  const s = t.trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const stop = cut.lastIndexOf('. ');
  return (stop > max * 0.5 ? cut.slice(0, stop + 1) : cut.slice(0, cut.lastIndexOf(' '))) + ' …';
}

async function clearOurs() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => n.identifier.startsWith('daily-')).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

/** (re)build the schedule from the saved preferences */
export async function syncDaily(p?: DailyPrefs) {
  if (!dailySupported) return;
  const prefs = p ?? (await loadDaily());
  await clearOurs();
  if (!prefs.enabled) return;
  const now = new Date();
  for (let i = 0; i < DAYS; i++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, prefs.hour, prefs.minute, 0);
    if (at.getTime() <= now.getTime() + 30_000) continue;
    const h = await api.hadithOn(at).catch(() => null);
    if (!h) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: `daily-${i}`,
      content: {
        title: `Hadith of the day · ${h.book_title_ml}`,
        body: clip(stripNarrator(h.malayalam_text, h.narrator_ml)),
        data: { hadithId: h.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  }
}

/** ask for permission, save, schedule. Returns false when the user refuses permission. */
export async function setDaily(next: DailyPrefs): Promise<boolean> {
  if (next.enabled) {
    let st = (await Notifications.getPermissionsAsync()).status;
    if (st !== 'granted') st = (await Notifications.requestPermissionsAsync()).status;
    if (st !== 'granted') return false;
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  await syncDaily(next);
  return true;
}
