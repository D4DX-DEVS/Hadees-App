import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { AnswerText } from '@/components/answer';
import { FeedbackNudge } from '@/components/feedback-nudge';
import { useHadithSheet } from '@/components/hadith-sheet';
import { Appear, ThinkingDots } from '@/components/motion';
import { BookList } from '@/components/booklist';
import { Composer, Mode } from '@/components/composer';
import { HadithListCard } from '@/components/hadith';
import { Card, Chip, Column, Divider, IconButton, Row, SectionTitle, T } from '@/components/ui';
import { ai, api, configured } from '@/lib/api';
import { FEATURES, route } from '@/lib/intents';
import { sourceList } from '@/lib/sources';
import { useLoad } from '@/lib/use-load';
import { citation } from '@/lib/text';
import { radius, space } from '@/lib/theme';
import type { Article, Hadith, TitleHit } from '@/lib/types';
import { useLibrary } from '@/state/library';
import { useSettings } from '@/state/settings';
import { friendlyError } from '@/lib/errors';

type Turn = {
  id: number;
  q: string;
  mode: Mode;
  status: 'loading' | 'done' | 'error';
  error?: string;
  // search
  results?: Hadith[];
  titles?: TitleHit[];
  total?: number;
  // ask
  answer?: string;
  sources?: Hadith[];
  // chat commands
  kind?: 'help' | 'books' | 'articles' | 'hint' | 'textsize';
  text?: string;
  articles?: Article[];
};

const SUGGEST_ASK = [
  'What do the hadith say about the virtue of fasting?',
  'Duties towards parents',
  'Honesty in trade',
  'Mahr in marriage',
];

export default function AskScreen() {
  const { colors, settings, update } = useSettings();
  const { addSearch, reads } = useLibrary();
  const [mode, setMode] = useState<Mode>(ai.enabled ? 'ask' : 'search');
  const [turns, setTurns] = useState<Turn[]>([]);
  const scroller = useRef<ScrollView>(null);
  const nextId = useRef(1);

  const params = useLocalSearchParams<{ q?: string; mode?: string; n?: string }>();
  const busy = turns.some((t) => t.status === 'loading');

  const patch = (id: number, p: Partial<Turn>) => setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));

  async function run(q: string, m: Mode = mode) {
    const id = nextId.current++;
    const it = route(q);
    const hint = (text: string) => setTurns((ts) => [...ts, { id, q, mode: m, status: 'done', kind: 'hint', text }]);
    if (it.kind === 'textsize') {
      const size = Math.min(28, Math.max(12, settings.mlSize + it.delta));
      update({ mlSize: size });
      hint(`Malayalam text size: ${size}`);
      return;
    }
    if (it.kind === 'daily' || it.kind === 'random' || it.kind === 'jump' || it.kind === 'narrator') {
      // all of these show hadith cards, rendered like search results
      setTurns((ts) => [...ts, { id, q, mode: 'search', status: 'loading' }]);
      try {
        let results: Hadith[] = [];
        let total = 0;
        if (it.kind === 'daily') {
          const h = await api.dailyHadith();
          results = h ? [h] : [];
        } else if (it.kind === 'random') {
          const n = await api.hadithCount();
          const h = n ? await api.hadithAt(Math.floor(Math.random() * n)) : null;
          results = h ? [h] : [];
        } else if (it.kind === 'narrator') {
          const r = await api.narratorByName(it.name);
          results = r.rows;
          total = r.total;
        } else {
          const books = await api.searchTitles(it.term).catch(() => []);
          const book = books.find((b) => b.kind === 'book');
          if (!book) {
            // not a book name: treat the whole text as a normal search
            const found = await api.search(it.q, { limit: 5 });
            patch(id, { status: 'done', mode: 'search', results: found, titles: [], total: Number(found[0]?.total ?? 0) });
            return;
          }
          results = await api.hadithByNumber(book.id, it.no);
          total = results.length;
          if (!results.length) {
            patch(id, { status: 'done', mode: 'search', results: [], titles: [], total: 0 });
            return;
          }
        }
        patch(id, { status: 'done', results, titles: [], total: total || results.length });
      } catch (e) {
        patch(id, { status: 'error', error: friendlyError(e) });
      }
      return;
    }
    if (it.kind === 'search' && it.vol) {
      setTurns((ts) => [...ts, { id, q: it.q, mode: 'search', status: 'loading' }]);
      try {
        const results = await api.search(it.q, { vol: it.vol, limit: 5 });
        patch(id, { status: 'done', results, titles: [], total: Number(results[0]?.total ?? 0) });
      } catch (e) {
        patch(id, { status: 'error', error: friendlyError(e) });
      }
      return;
    }
    if (it.kind === 'help' || it.kind === 'books') {
      setTurns((ts) => [...ts, { id, q, mode: m, status: 'done', kind: it.kind }]);
      return;
    }
    if (it.kind === 'nav') {
      router.push(it.path);
      return;
    }
    if (it.kind === 'hint') {
      setTurns((ts) => [...ts, { id, q, mode: m, status: 'done', kind: 'hint', text: it.text }]);
      return;
    }
    if (it.kind === 'articles') {
      setTurns((ts) => [...ts, { id, q, mode: m, status: 'loading' }]);
      try {
        patch(id, { status: 'done', kind: 'articles', articles: await api.articles() });
      } catch (e) {
        patch(id, { status: 'error', error: friendlyError(e) });
      }
      return;
    }
    if (it.kind === 'search') {
      q = it.q;
      m = 'search';
    }
    setTurns((ts) => [...ts, { id, q, mode: m, status: 'loading' }]);
    addSearch(q, m);
    try {
      if (m === 'ask' && ai.enabled) {
        const history = turns
          .filter((t) => t.mode === 'ask' && t.answer)
          .slice(-3)
          .flatMap((t) => [
            { role: 'user' as const, content: t.q },
            { role: 'assistant' as const, content: t.answer! },
          ]);
        const r = await ai.ask(q, history);
        patch(id, { status: 'done', answer: r.answer, sources: r.sources });
      } else {
        const [results, titles] = await Promise.all([api.search(q, { limit: 5 }), api.searchTitles(q).catch(() => [])]);
        patch(id, { status: 'done', results, titles, total: Number(results[0]?.total ?? 0) });
      }
    } catch (e) {
      patch(id, { status: 'error', error: friendlyError(e) });
    }
  }

  // side menu: open a recent question / start a new chat
  const handled = useRef('');
  useEffect(() => {
    const n = params.n;
    if (!n || handled.current === n) return;
    const q = params.q;
    const m: Mode = params.mode === 'ask' && ai.enabled ? 'ask' : 'search';
    const t = setTimeout(() => {
      handled.current = n;
      setTurns([]);
      if (q) {
        setMode(m);
        run(q, m);
      }
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.n]);

  useEffect(() => {
    if (turns.length) setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
  }, [turns.length]);

  const empty = turns.length === 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Row gap={0}>
              {empty ? null : <IconButton name="create-outline" label="New chat" onPress={() => setTurns([])} />}
              <IconButton name="settings-outline" label="Settings" size={22} color={colors.text} onPress={() => router.push('/settings')} />
            </Row>
          ),
        }}
      />
      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: space.md, paddingBottom: space.xl, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled">
        <Column style={{ flex: 1 }}>
          {!configured && (
            <Card style={{ marginBottom: space.lg, borderColor: colors.danger }}>
              <T weight="bold" color="danger">No database connection</T>
              <T variant="caption" color="muted">Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to app/.env.</T>
            </Card>
          )}

          {empty ? (
            <Welcome mode={mode} onPick={(q) => run(q)} last={reads[0]} />
          ) : (
            turns.map((t) => <TurnView key={t.id} t={t} onRetry={() => run(t.q, t.mode)} onAction={(q) => run(q)} />)
          )}
        </Column>
      </ScrollView>

      <Column style={{ paddingBottom: Platform.OS === 'web' ? space.lg : space.sm, paddingTop: space.xs }}>
        <Composer onSubmit={(q) => run(q)} mode={mode} onMode={setMode} aiEnabled={ai.enabled} busy={busy} />
      </Column>
      <FeedbackNudge />
    </KeyboardAvoidingView>
  );
}

function Welcome({ mode, onPick, last }: { mode: Mode; onPick: (q: string) => void; last?: { id: number; book_title_ml: string; hadith_no: number } }) {
  const { colors } = useSettings();
  const daily = useLoad(() => api.dailyHadith(), []).data;
  if (mode === 'search') {
    // Library mode: the library itself is the default content
    return (
      <View style={{ paddingVertical: space.md }}>
        <BookList />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: space.xl }}>
      <Appear><T variant="heading" center color="muted" weight="medium">Ask anything about the hadith</T></Appear>
      <Row wrap style={{ justifyContent: 'center', marginTop: space.lg }}>
        {SUGGEST_ASK.map((s, i) => (
          <Appear key={s} index={i + 1}>
            <Chip label={s} icon="sparkles-outline" onPress={() => onPick(s)} />
          </Appear>
        ))}
        <Appear index={SUGGEST_ASK.length + 1}>
          <Chip label="What can I do?" icon="help-circle-outline" onPress={() => onPick("help")} />
        </Appear>
      </Row>
      {daily ? (
        <Appear index={7} style={{ marginTop: space.lg, alignSelf: 'stretch' }}>
          <Card onPress={() => router.push({ pathname: '/hadith/[id]', params: { id: String(daily.id) } })} style={{ padding: space.md }}>
            <Row>
              <Ionicons name="sunny-outline" size={22} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <T variant="tiny" color="faint" weight="bold" style={{ letterSpacing: 0.6 }}>HADITH OF THE DAY</T>
                <T variant="label" weight="medium" numberOfLines={1}>{citation(daily)}</T>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </Row>
          </Card>
        </Appear>
      ) : null}
      {last ? (
        <Appear index={6} style={{ marginTop: space.xl, alignSelf: 'stretch' }}>
          <Card onPress={() => router.push({ pathname: '/hadith/[id]', params: { id: String(last.id) } })} style={{ padding: space.md }}>
            <Row>
              <Ionicons name="play-circle-outline" size={22} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <T variant="tiny" color="faint" weight="bold" style={{ letterSpacing: 0.6 }}>CONTINUE READING</T>
                <T variant="label" weight="medium" numberOfLines={1}>{`${last.book_title_ml} · Hadith ${last.hadith_no}`}</T>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </Row>
          </Card>
        </Appear>
      ) : null}
    </View>
  );
}

function TurnView({ t, onRetry, onAction }: { t: Turn; onRetry: () => void; onAction: (q: string) => void }) {
  const { colors } = useSettings();
  const [showPassages, setShowPassages] = useState(false);
  const { open: openSheet } = useHadithSheet();
  const counts = useLoad(() => api.refCounts((t.results ?? t.sources ?? []).map((r) => r.id)), [t.status]).data ?? {};
  return (
    <Appear style={{ marginBottom: space.xl }}>
      <View style={[styles.bubble, { backgroundColor: colors.accentSoft }]}>
        <T>{t.q}</T>
      </View>

      <Row gap={6} style={{ marginBottom: space.sm }}>
        <Ionicons name={t.kind ? 'apps-outline' : t.mode === 'ask' ? 'sparkles' : 'search'} size={16} color={colors.accent} />
        <T variant="caption" color="muted" weight="medium">{t.kind === 'help' ? 'Menu' : t.kind === 'articles' ? 'Articles' : t.kind === 'books' ? 'Library' : t.kind === 'hint' ? 'Hint' : t.mode === 'ask' ? 'AI answer' : 'Library results'}</T>
      </Row>

      {t.status === 'loading' && (
        <Row gap={10} style={{ paddingVertical: space.lg }}>
          <ThinkingDots color={colors.accent} />
          <T variant="caption" color="muted">{t.mode === 'ask' ? 'Reading the hadith…' : 'Searching the library…'}</T>
        </Row>
      )}

      {t.status === 'error' && (
        <Card>
          <T color="danger" weight="medium">{t.error}</T>
          <Chip label="Retry" icon="refresh" onPress={onRetry} style={{ marginTop: space.sm, alignSelf: 'flex-start' }} />
        </Card>
      )}

      {t.status === 'done' && t.kind === 'help' && (
        <Column style={{ gap: space.sm }}>
          <T color="muted">You can type any of these, or tap one:</T>
          {FEATURES.map((f) => (
            <Card key={f.label} onPress={() => onAction(f.q)} style={{ padding: space.md }}>
              <Row>
                <Ionicons name={f.icon as 'book-outline'} size={22} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <T weight="medium">{f.label}</T>
                  <T variant="caption" color="muted">{f.hint}</T>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
              </Row>
            </Card>
          ))}
        </Column>
      )}

      {t.status === 'done' && t.kind === 'books' && <BookList />}

      {t.status === 'done' && t.kind === 'hint' && <Card><T color="muted">{t.text}</T></Card>}

      {t.status === 'done' && t.kind === 'articles' && (
        <Column style={{ gap: space.sm }}>
          {(t.articles ?? []).length === 0 && <T color="muted">No articles yet.</T>}
          {(t.articles ?? []).map((a) => (
            <Card key={a.id} onPress={() => router.push({ pathname: '/article/[id]', params: { id: String(a.id) } })} style={{ padding: space.md }}>
              <Row>
                <Ionicons name="document-text-outline" size={20} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <T weight="medium" numberOfLines={2}>{a.title_ml}</T>
                  <T variant="tiny" color="faint">{`Volume ${a.volume_id} · Section ${a.section_no}`}</T>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
              </Row>
            </Card>
          ))}
        </Column>
      )}

      {t.status === 'done' && t.mode === 'ask' && (
        <>
          <Card>
            <AnswerText text={t.answer ?? ''} sources={t.sources ?? []} animate />
          </Card>
          {!!t.answer && (
            <Chip
              label="Share answer"
              icon="share-outline"
              onPress={() =>
                Share.share({
                  message: `${t.q}\n\n${t.answer}\n\n${(t.sources ?? []).map((h, i) => `[${i + 1}] ${citation(h)}`).join('\n')}`,
                })
              }
              style={{ alignSelf: 'flex-start', marginBottom: space.sm }}
            />
          )}
          {!!t.sources?.length && (
            <>
              <SectionTitle>References ({t.sources.length})</SectionTitle>
              <Card padded={false}>
                {t.sources.map((h, i) => (
                  <View key={h.id}>
                    {i > 0 && <Divider />}
                    <Pressable
                      onPress={() => openSheet(h.id)}
                      style={({ pressed }) => [styles.ref, pressed && { backgroundColor: colors.surfaceAlt }]}>
                      <View style={[styles.refNo, { backgroundColor: colors.accentSoft }]}>
                        <T variant="caption" weight="bold" color="accent">{i + 1}</T>
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <T variant="caption" weight="medium">{citation(h)}</T>
                        {h.chapter_title_ml ? <T variant="tiny" color="faint" numberOfLines={1}>{h.chapter_title_ml}</T> : null}
                        <T variant="tiny" color="muted" numberOfLines={1}>
                          {[h.narrator_ml, sourceList(h.source_codes_ml)].filter(Boolean).join('  ·  ')}
                        </T>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                    </Pressable>
                  </View>
                ))}
              </Card>
              <Chip
                label={showPassages ? 'Hide passages' : 'Show full passages'}
                icon={showPassages ? 'chevron-up' : 'chevron-down'}
                onPress={() => setShowPassages((v) => !v)}
                style={{ alignSelf: 'center', marginTop: space.md }}
              />
              {showPassages &&
                t.sources.map((h, i) => (
                  <View key={h.id} style={{ marginTop: space.sm }}>
                    <T variant="tiny" color="accent" weight="bold" style={{ marginBottom: 2 }}>[{i + 1}]</T>
                    <HadithListCard h={h} index={i} refCount={counts[h.id]} />
                  </View>
                ))}
            </>
          )}
        </>
      )}

      {t.status === 'done' && t.mode === 'search' && (
        <>
          {!!t.titles?.length && (
            <Row wrap style={{ marginBottom: space.md }}>
              {t.titles.slice(0, 4).map((x) => (
                <Chip
                  key={`${x.kind}${x.id}`}
                  icon={x.kind === 'book' ? 'book-outline' : 'list-outline'}
                  label={x.title_ml}
                  onPress={() =>
                    x.kind === 'book'
                      ? router.push({ pathname: '/book/[id]', params: { id: String(x.id) } })
                      : router.push({ pathname: '/chapter/[id]', params: { id: String(x.id) } })
                  }
                />
              ))}
            </Row>
          )}
          {t.results?.length ? (
            <>
              <T variant="caption" color="muted" style={{ marginBottom: space.sm }}>{t.total} hadith found</T>
              {t.results.map((h, i) => <HadithListCard key={h.id} h={h} query={t.q} index={i} refCount={counts[h.id]} />)}
              {(t.total ?? 0) > (t.results?.length ?? 0) && (
                <Chip
                  label={`See all ${t.total} results`}
                  icon="arrow-forward"
                  onPress={() => router.push({ pathname: '/search', params: { q: t.q } })}
                  style={{ alignSelf: 'center' }}
                />
              )}
            </>
          ) : (
            <Card>
              <T color="muted">No results. Try another word{ai.enabled ? ' or use Ask AI' : ''}.</T>
            </Card>
          )}
        </>
      )}
    </Appear>
  );
}

const styles = StyleSheet.create({
  ref: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, paddingHorizontal: space.md },
  refNo: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bubble: { alignSelf: 'flex-end', maxWidth: '85%', borderRadius: radius.lg, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10, marginBottom: space.md },
});
