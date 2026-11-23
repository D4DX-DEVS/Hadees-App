import { Platform } from 'react-native';

import { request } from './api';
import { load, save } from './storage';

export type FeedbackKind = 'idea' | 'problem' | 'text' | 'praise';

export async function sendFeedback(p: { kind: FeedbackKind; message: string; contact?: string; page?: string }) {
  await request('feedback', {}, { ...p, message: p.message.trim(), contact: p.contact?.trim() || null, platform: Platform.OS });
}

// ── gentle "you can send feedback" nudge: rare, dismissible, never after the user has sent feedback ──
const KEY = 'hv.feedbackNudge.v1';
type NudgeState = { last: number; dismissals: number; done: boolean };
const DEFAULT: NudgeState = { last: 0, dismissals: 0, done: false };
const MIN_READS = 8;                       // only after the user has actually used the app
const GAP_MS = 14 * 24 * 3600 * 1000;      // at most once every two weeks
const MAX_DISMISSALS = 2;                  // then never again

export async function shouldNudge(readCount: number) {
  if (readCount < MIN_READS) return false;
  const s = await load<NudgeState>(KEY, DEFAULT);
  return !s.done && s.dismissals < MAX_DISMISSALS && Date.now() - s.last > GAP_MS;
}
export async function nudgeShown(action: 'dismissed' | 'opened') {
  const s = await load<NudgeState>(KEY, DEFAULT);
  await save(KEY, { ...s, last: Date.now(), dismissals: s.dismissals + (action === 'dismissed' ? 1 : 0) });
}
export async function feedbackSent() {
  const s = await load<NudgeState>(KEY, DEFAULT);
  await save(KEY, { ...s, done: true, last: Date.now() });
}
