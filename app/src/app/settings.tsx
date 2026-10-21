import { Ionicons } from '@expo/vector-icons';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Switch, View } from 'react-native';

import { ArabicText, MalayalamText } from '@/components/hadith';
import { Card, Chip, Divider, Row, Screen, T } from '@/components/ui';
import { ai } from '@/lib/api';
import { dailySupported, DailyPrefs, loadDaily, setDaily } from '@/lib/daily';
import { arabicFonts, malayalamFonts, palettes, radius, shadow, space, ThemeName } from '@/lib/theme';
import { Align, Settings, useSettings } from '@/state/settings';

const SAMPLE_AR = 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى';
const SAMPLE_ML = 'തീർച്ചയായും കർമ്മങ്ങൾ ഉദ്ദേശ്യങ്ങൾ അനുസരിച്ചാണ്. ഓരോരുത്തർക്കും അവൻ ഉദ്ദേശിച്ചതേ ലഭിക്കൂ.';

export default function SettingsScreen() {
  const { settings, update, reset, colors } = useSettings();

  return (
    <Screen contentStyle={{ paddingTop: 0 }} stickyHeaderIndices={[0]}>
      {/* live preview stays pinned while you adjust */}
      <View style={{ backgroundColor: colors.bg, paddingTop: space.md, paddingBottom: space.sm }}>
        <Card style={{ borderRadius: radius.lg, paddingVertical: space.md }}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 2 }}>
            <T variant="tiny" color="faint" weight="bold" style={{ letterSpacing: 0.6 }}>PREVIEW</T>
            <T variant="tiny" color="faint">Changes apply everywhere</T>
          </Row>
          {settings.showArabic && <ArabicText text={SAMPLE_AR} />}
          <MalayalamText text={SAMPLE_ML} />
        </Card>
      </View>

      <Group title="Appearance">
        <Row wrap gap={space.sm}>
          {(['system', 'light', 'sepia', 'dark'] as const).map((t) => (
            <ThemeSwatch key={t} name={t} active={settings.theme === t} onPress={() => update({ theme: t })} />
          ))}
        </Row>
      </Group>

      <Group title="Malayalam text" icon="text">
        <Label>Font</Label>
        <Row wrap>
          {malayalamFonts.map((f) => (
            <Chip key={f.key} label={f.label} active={settings.mlFont === f.key} onPress={() => update({ mlFont: f.key })} />
          ))}
        </Row>
        <Divider style={styles.gap} />
        <Slide label="Size" value={settings.mlSize} min={16} max={30} onChange={(v) => update({ mlSize: v })} fmt={(v) => `${v} pt`} />
        <Slide label="Line spacing" value={settings.lineHeight} min={1.3} max={2.2} step={0.1} onChange={(v) => update({ lineHeight: v })} fmt={(v) => v.toFixed(1)} />
        <Divider style={styles.gap} />
        <Label>Alignment</Label>
        <AlignControl value={settings.mlAlign} onChange={(v) => update({ mlAlign: v })} options={['left', 'center', 'right']} />
        <T variant="tiny" color="faint" style={{ marginTop: space.sm }}>Justify is not offered for Malayalam: phones spread the letters inside words.</T>
      </Group>

      <Group title="Arabic text" icon="language">
        <Label>Font</Label>
        <Row wrap>
          {arabicFonts.map((f) => (
            <Chip key={f.key} label={f.label} active={settings.arFont === f.key} onPress={() => update({ arFont: f.key })} />
          ))}
        </Row>
        <Divider style={styles.gap} />
        <Slide label="Size" value={settings.arSize} min={16} max={40} onChange={(v) => update({ arSize: v })} fmt={(v) => `${v} pt`} />
        <Divider style={styles.gap} />
        <Label>Alignment</Label>
        <AlignControl value={settings.arAlign} onChange={(v) => update({ arAlign: v })} />
      </Group>

      <Group title="Display">
        <Toggle label="Show Arabic text" k="showArabic" />
        <Divider />
        <Toggle label="Harakat (vowel marks)" k="showHarakat" />
        <Divider />
        <Toggle label="Arabic before Malayalam" k="arabicFirst" />
        <Divider />
        <Toggle label="Collapse Arabic (Malayalam first)" k="arabicCollapsed" />
        <Divider />
        <Toggle label="Narrator name" k="showNarrator" />
      </Group>

      {dailySupported ? <DailyGroup /> : null}

      <Group title="About">
        <T weight="medium">Hadees Vijnanakosham (ഹദീസ് വിജ്ഞാനകോശം)</T>
        <T variant="caption" color="muted" style={{ marginTop: 4 }}>
          Three volumes · 8,500+ hadith · Bookmarks and history stay on this device only.
        </T>
        <Row style={{ marginTop: space.sm }}>
          <Ionicons name={ai.enabled ? 'sparkles' : 'sparkles-outline'} size={16} color={ai.enabled ? colors.accent : colors.textFaint} />
          <T variant="caption" color={ai.enabled ? 'accent' : 'faint'}>{ai.enabled ? 'AI search enabled' : 'AI search not configured'}</T>
        </Row>
      </Group>

      <Chip label="Reset all to defaults" icon="refresh" onPress={reset} style={{ alignSelf: 'center', marginTop: space.xl }} />
    </Screen>
  );
}

const TIMES: [number, number, string][] = [[5, 0, '5:00 am'], [7, 0, '7:00 am'], [12, 30, '12:30 pm'], [18, 0, '6:00 pm'], [21, 0, '9:00 pm']];

function DailyGroup() {
  const { colors } = useSettings();
  const [prefs, setPrefs] = useState<DailyPrefs | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => { loadDaily().then(setPrefs); }, []);
  if (!prefs) return null;

  async function change(next: DailyPrefs) {
    setNote('');
    const ok = await setDaily(next);
    if (ok) setPrefs(next);
    else setNote('Notifications are turned off for this app. Allow them in your phone settings to get a daily hadith.');
  }

  return (
    <Group title="Daily hadith" icon="notifications-outline">
      <Row style={{ justifyContent: 'space-between', paddingVertical: 4 }}>
        <View style={{ flex: 1, paddingRight: space.md }}>
          <T>Remind me every day</T>
          <T variant="caption" color="muted">A hadith arrives as a notification. Tap it to read.</T>
        </View>
        <Switch
          value={prefs.enabled}
          onValueChange={(v) => change({ ...prefs, enabled: v })}
          trackColor={{ true: colors.accent, false: colors.border }}
          thumbColor="#fff"
        />
      </Row>
      {prefs.enabled ? (
        <View style={{ marginTop: space.md }}>
          <Label>Time</Label>
          <Row wrap>
            {TIMES.map(([hour, minute, label]) => (
              <Chip key={label} label={label} active={prefs.hour === hour && prefs.minute === minute} onPress={() => change({ ...prefs, hour, minute })} />
            ))}
          </Row>
        </View>
      ) : null}
      {note ? <T variant="caption" color="danger" style={{ marginTop: space.sm }}>{note}</T> : null}
    </Group>
  );
}

// ───────── building blocks ─────────

function Group({ title, icon, children }: { title: string; icon?: keyof typeof Ionicons.glyphMap; children: ReactNode }) {
  const { colors } = useSettings();
  return (
    <View style={{ marginTop: space.lg }}>
      <Row gap={6} style={{ marginBottom: space.sm, paddingLeft: 4 }}>
        {icon ? <Ionicons name={icon} size={16} color={colors.accent} /> : null}
        <T variant="label" weight="bold" color="muted" style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 12 }}>{title}</T>
      </Row>
      <Card style={{ paddingVertical: space.md }}>{children}</Card>
    </View>
  );
}

const Label = ({ children }: { children: ReactNode }) => (
  <T variant="caption" color="muted" weight="medium" style={{ marginBottom: space.sm }}>{children}</T>
);

function ThemeSwatch({ name, active, onPress }: { name: 'system' | ThemeName; active: boolean; onPress: () => void }) {
  const { colors } = useSettings();
  const p = palettes[name === 'system' ? 'light' : name];
  const label = { system: 'System', light: 'Light', sepia: 'Sepia', dark: 'Dark' }[name];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={[styles.swatch, { borderColor: active ? colors.accent : colors.border, borderWidth: active ? 2 : 1 }]}>
      <View style={[styles.swatchInner, { backgroundColor: p.bg }]}>
        {name === 'system' ? (
          <View style={{ flexDirection: 'row', flex: 1, width: '100%', borderRadius: 6, overflow: 'hidden' }}>
            <View style={{ flex: 1, backgroundColor: palettes.light.surface }} />
            <View style={{ flex: 1, backgroundColor: palettes.dark.surface }} />
          </View>
        ) : (
          <T style={{ color: p.text, fontSize: 18 }}>Aa</T>
        )}
      </View>
      <Row gap={4}>
        {active ? <Ionicons name="checkmark-circle" size={16} color={colors.accent} /> : null}
        <T variant="tiny" weight="medium" color={active ? 'accent' : 'muted'}>{label}</T>
      </Row>
    </Pressable>
  );
}

/** Label + value + draggable slider with − / + buttons. */
function Slide({
  label, value, min, max, step = 1, fmt = (v) => String(v), onChange,
}: { label: string; value: number; min: number; max: number; step?: number; fmt?: (v: number) => string; onChange: (v: number) => void }) {
  const { colors } = useSettings();
  const width = useRef(1);
  const [dragging, setDragging] = useState(false);
  const clampTo = (v: number, lo: number, hi: number, st: number) => Math.round(Math.min(hi, Math.max(lo, v)) / st) * st;
  const set = (v: number) => onChange(Math.round(clampTo(v, min, max, step) * 100) / 100);
  const frac = (value - min) / (max - min);

  // handlers read the latest props through a ref so the PanResponder can be created once
  const latest = useRef({ min, max, step, onChange });
  useEffect(() => {
    latest.current = { min, max, step, onChange };
  });
  // the refs are only read inside gesture handlers (never while rendering)
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => {
    const fromX = (x: number) => {
      const { min: lo, max: hi, step: st, onChange: cb } = latest.current;
      const v = lo + (Math.min(Math.max(x, 0), width.current) / width.current) * (hi - lo);
      cb(Math.round(clampTo(v, lo, hi, st) * 100) / 100);
    };
    let x0 = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        x0 = e.nativeEvent.locationX;
        setDragging(true);
        fromX(x0);
      },
      onPanResponderMove: (_e, g) => fromX(x0 + g.dx),
      onPanResponderRelease: () => setDragging(false),
      onPanResponderTerminate: () => setDragging(false),
    });
  });

  return (
    <View style={{ marginBottom: space.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T variant="label" weight="medium">{label}</T>
        <Row gap={6}>
          <StepBtn icon="remove" label={`Decrease ${label}`} onPress={() => set(value - step)} />
          <T variant="label" weight="bold" style={{ minWidth: 52, textAlign: 'center' }}>{fmt(value)}</T>
          <StepBtn icon="add" label={`Increase ${label}`} onPress={() => set(value + step)} />
        </Row>
      </Row>
      <View
        {...pan.panHandlers}
        onLayout={(e) => { width.current = Math.max(1, e.nativeEvent.layout.width); }}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value }}
        style={styles.sliderHit}>
        <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
          <View style={{ width: `${frac * 100}%`, height: '100%', backgroundColor: colors.accent }} />
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            { left: `${frac * 100}%`, backgroundColor: colors.surface, borderColor: colors.accent, transform: [{ translateX: -11 }, { scale: dragging ? 1.15 : 1 }] },
          ]}
        />
      </View>
    </View>
  );
}

function StepBtn({ icon, onPress, label }: { icon: 'add' | 'remove'; onPress: () => void; label: string }) {
  const { colors } = useSettings();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={6} style={[styles.stepBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
      <Ionicons name={icon} size={16} color={colors.text} />
    </Pressable>
  );
}

const ALIGNS: { key: Align; label: string }[] = [
  { key: 'left', label: 'Left' },
  { key: 'center', label: 'Center' },
  { key: 'right', label: 'Right' },
  { key: 'justify', label: 'Justify' },
];

/** Four-way alignment picker with drawn text-line icons. */
function AlignControl({ value, onChange, options }: { value: Align; onChange: (v: Align) => void; options?: Align[] }) {
  const { colors } = useSettings();
  return (
    <View style={[styles.segment, { backgroundColor: colors.surfaceAlt }]} accessibilityRole="radiogroup">
      {ALIGNS.filter((a) => !options || options.includes(a.key)).map((a) => {
        const on = a.key === value;
        return (
          <Pressable
            key={a.key}
            onPress={() => onChange(a.key)}
            accessibilityRole="radio"
            accessibilityLabel={`Align ${a.label}`}
            accessibilityState={{ selected: on }}
            style={[styles.segItem, on && { backgroundColor: colors.surface, borderColor: colors.accent, ...shadowSm }]}>
            <AlignIcon align={a.key} color={on ? colors.accent : colors.textMuted} />
            <T variant="tiny" weight="medium" color={on ? 'accent' : 'muted'}>{a.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

function AlignIcon({ align, color }: { align: Align; color: string }) {
  const W = 22;
  const lines = [1, 0.62, 1, 0.78];
  return (
    <View style={{ width: W, gap: 3 }}>
      {lines.map((f, i) => {
        const last = i === lines.length - 1;
        const w = align === 'justify' ? W : W * f;
        const self = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
        return <View key={i} style={{ height: 2.5, borderRadius: 2, width: last && align === 'justify' ? W * 0.6 : w, backgroundColor: color, alignSelf: self }} />;
      })}
    </View>
  );
}

function Toggle({ label, k }: { label: string; k: keyof Pick<Settings, 'showArabic' | 'showHarakat' | 'arabicFirst' | 'showNarrator' | 'arabicCollapsed'> }) {
  const { settings, update, colors } = useSettings();
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 8 }}>
      <T>{label}</T>
      <Switch
        value={settings[k]}
        onValueChange={(v) => update({ [k]: v } as Partial<Settings>)}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor="#fff"
        {...({ activeThumbColor: '#fff' } as object)}
      />
    </Row>
  );
}

const shadowSm = { ...(shadow as object) };

const styles = StyleSheet.create({
  gap: { marginVertical: space.md },
  swatch: { width: 76, alignItems: 'center', gap: 6, padding: 6, borderRadius: radius.md },
  swatchInner: { width: '100%', height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  sliderHit: { height: 36, justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  thumb: { position: 'absolute', width: 22, height: 22, borderRadius: 11, borderWidth: 2, top: 7 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', borderRadius: radius.md, padding: 3, gap: 3 },
  segItem: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 9, borderRadius: radius.sm + 2, borderWidth: 1, borderColor: 'transparent' },
});
