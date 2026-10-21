import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { HadithListCard } from '@/components/hadith';
import { Card, Chip, Column, Empty, ErrorView, Loading, Row, T, useUiFont } from '@/components/ui';
import { ai, api } from '@/lib/api';
import { sourceName } from '@/lib/sources';
import { expandQuery } from '@/lib/synonyms';
import { maxWidth, radius, space } from '@/lib/theme';
import type { Hadith, Source } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { useLibrary } from '@/state/library';
import { useSettings } from '@/state/settings';

const PAGE = 30;

export default function SearchScreen() {
  const params = useLocalSearchParams<{ q?: string; vol?: string; book?: string; src?: string; narrator?: string; narratorName?: string }>();
  const { colors } = useSettings();
  const font = useUiFont();
  const { addSearch, searches } = useLibrary();

  const [input, setInput] = useState(params.q ?? '');
  const [q, setQ] = useState(params.q ?? '');
  const [vol, setVol] = useState<number | null>(params.vol ? Number(params.vol) : null);
  const [src, setSrc] = useState<string | null>(params.src ?? null);
  const [semantic, setSemantic] = useState(false);
  const [sort, setSort] = useState<'relevance' | 'book'>('relevance');
  const [narrFilter, setNarrFilter] = useState<{ key: string; label: string } | null>(null); // narrator picked from the suggestions
  const [focused, setFocused] = useState(false);
  const [typed, setTyped] = useState('');  // input, debounced for suggestions
  useEffect(() => {
    const t = setTimeout(() => setTyped(input.trim()), 220);
    return () => clearTimeout(t);
  }, [input]);
  const book = params.book ? Number(params.book) : null;
  const narratorId = params.narrator ? Number(params.narrator) : null;
  const narratorName = params.narratorName ?? null;
  const narrator = useLoad(() => (narratorId ? api.narrator(narratorId) : Promise.resolve(null)), [narratorId]).data;
  const sources = useLoad(() => api.sources(), []).data ?? ([] as Source[]);

  // first page via useLoad (keyed by query + filters); later pages appended in `more`
  const first = useLoad(async () => {
    if (narratorName) {
      const r = await api.narratorByName(narratorName, 0, PAGE);
      return { rows: r.rows, total: r.total };
    }
    if (narratorId) {
      const r = await api.narratorHadiths(narratorId, 0, PAGE);
      return { rows: r, total: Number(r[0]?.total ?? 0) };
    }
    if (!q.trim() && !src && !book && !narrFilter) return { rows: [] as Hadith[], total: 0 };
    if (semantic && ai.enabled) {
      const r = await ai.semantic(q, vol);
      return { rows: r, total: r.length };
    }
    const r = await api.search(q, { vol, book, src, limit: PAGE, offset: 0, sort, ngroup: narrFilter?.key ?? null });
    return { rows: r, total: Number(r[0]?.total ?? 0) };
  }, [q, vol, src, book, semantic, narratorId, narratorName, sort, narrFilter]);
  const pageKey = `${q}|${vol}|${src}|${book}|${semantic}|${narratorId}|${narratorName}|${sort}|${narrFilter?.key}`;
  const [more, setMore] = useState<{ key: string; rows: Hadith[]; loading: boolean }>({ key: '', rows: [], loading: false });
  const extra = more.key === pageKey ? more.rows : [];
  const rows = first.data ? [...first.data.rows, ...extra] : [];
  const total = first.data?.total ?? 0;
  const counts = useLoad(() => api.refCounts(rows.map((r) => r.id)), [rows.length, pageKey]).data ?? {};
  const loading = first.loading || (more.key === pageKey && more.loading);
  const error = first.error;

  const loadMore = async () => {
    if (loading || semantic || rows.length >= total) return;
    const key = pageKey;
    setMore({ key, rows: extra, loading: true });
    try {
      const r = narratorName
        ? (await api.narratorByName(narratorName, rows.length, PAGE)).rows
        : narratorId
        ? await api.narratorHadiths(narratorId, rows.length, PAGE)
        : await api.search(q, { vol, book, src, limit: PAGE, offset: rows.length, sort, ngroup: narrFilter?.key ?? null });
      setMore((m) => (m.key === key ? { key, rows: [...m.rows, ...r], loading: false } : m));
    } catch {
      setMore((m) => (m.key === key ? { ...m, loading: false } : m));
    }
  };

  const submit = (text?: string) => {
    const t = (text ?? input).trim();
    if (!t) return;
    addSearch(t, 'search');
    setInput(t);
    setNarrFilter(null);
    setQ(t);
    setFocused(false);
  };

  const pickNarrator = (key: string, label: string) => {
    setInput(label);
    setQ('');
    setNarrFilter({ key, label: label.replace(/\(.*?\)/g, '').trim() });
    setFocused(false);
  };

  // typing suggestions: narrators / chapters / books from the database, plus your own recent searches
  const typing = focused && typed.length > 0 && typed !== q && !narratorId && !narratorName;
  const typedEx = typing ? expandQuery(typed) : { terms: [] as string[], narrators: [] as string[] };
  // an English word is looked up by its Malayalam form
  const suggestFor = typedEx.narrators[0] ?? typedEx.terms[0] ?? typed;
  const sugg = useLoad(() => (typing ? api.suggest(suggestFor).catch(() => []) : Promise.resolve([])), [typing, suggestFor]).data ?? [];
  const recents = typing ? searches.filter((e) => e.q.toLowerCase().includes(typed.toLowerCase()) && e.q !== typed).slice(0, 3) : [];
  const alsoFor = expandQuery(q);
  const also = [...alsoFor.terms, ...alsoFor.narrators];
  const hq = alsoFor.terms[0] ?? (alsoFor.narrators.length ? undefined : q); // highlight the Malayalam word for an English search

  const header = (
    <Column style={{ paddingTop: space.md }}>
      {!narratorId && !narratorName && (
        <>
      <View style={[styles.searchBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => submit()}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          returnKeyType="search"
          autoFocus={!params.q && !params.src && !params.narrator && !params.book}
          placeholder="Malayalam, English or Arabic"
          placeholderTextColor={colors.textFaint}
          style={[{ flex: 1, fontSize: 16, color: colors.text, fontFamily: font() }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
        />
        {input ? <Ionicons name="close-circle" size={20} color={colors.textFaint} onPress={() => { setInput(''); setNarrFilter(null); }} /> : null}
      </View>

      {typing && (sugg.length > 0 || recents.length > 0 || typedEx.terms.length + typedEx.narrators.length > 0) ? (
        <Card style={{ marginTop: space.sm, padding: 0, overflow: 'hidden' }}>
          {typedEx.terms.length + typedEx.narrators.length > 0 ? (
            <SuggestRow icon="language-outline" label={`Search "${typed}"`} hint={[...typedEx.terms, ...typedEx.narrators].join(' · ')} onPress={() => submit(typed)} />
          ) : null}
          {recents.map((e) => (
            <SuggestRow key={e.q} icon="time-outline" label={e.q} onPress={() => submit(e.q)} />
          ))}
          {sugg.map((s) => (
            <SuggestRow
              key={`${s.kind}${s.id ?? s.label}`}
              icon={s.kind === 'narrator' ? 'person-outline' : s.kind === 'book' ? 'library-outline' : 'bookmark-outline'}
              label={s.label}
              hint={s.kind === 'narrator' ? `${s.n} hadith` : s.kind === 'book' ? `Book · ${s.n} hadith` : `Chapter · ${s.n}`}
              onPress={() =>
                s.kind === 'narrator' && s.key ? pickNarrator(s.key, s.label)
                : s.kind === 'book' ? router.push({ pathname: '/book/[id]', params: { id: String(s.id) } })
                : router.push({ pathname: '/chapter/[id]', params: { id: String(s.id) } })
              }
            />
          ))}
        </Card>
      ) : null}

      <Row wrap style={{ marginTop: space.md }}>
        {[null, 1, 2, 3].map((v) => (
          <Chip key={String(v)} label={v ? `Volume ${v}` : 'All'} active={vol === v} onPress={() => setVol(v)} />
        ))}
        {ai.enabled && (
          <Chip label="By meaning (AI)" icon="sparkles-outline" active={semantic} onPress={() => setSemantic((s) => !s)} />
        )}
      </Row>
      {!semantic && (q || narrFilter) ? (
        <Row wrap style={{ marginTop: space.sm }}>
          <Chip label="Best match" icon="sparkles-outline" active={sort === 'relevance'} onPress={() => setSort('relevance')} />
          <Chip label="Book order" icon="list-outline" active={sort === 'book'} onPress={() => setSort('book')} />
        </Row>
      ) : null}
      {!semantic && sources.length > 0 && (
        <Row wrap style={{ marginTop: space.sm }}>
          {sources.filter((s) => !s.code_ml.includes(',')).map((s) => (
            <Chip
              key={s.code_ar}
              label={sourceName(s.code_ml, 'short')}
              active={src === s.code_ml}
              onPress={() => setSrc(src === s.code_ml ? null : s.code_ml)}
            />
          ))}
        </Row>
      )}
        </>
      )}
      {narrFilter ? <T variant="heading" style={{ marginTop: space.md }}>{narrFilter.label}</T> : null}
      {also.length > 0 && !loading ? <T variant="caption" color="muted" style={{ marginTop: space.sm }}>Also searching: {also.join(' · ')}</T> : null}
      {narrator || narratorName ? (
        <T variant="heading" style={{ marginTop: space.md }}>{narrator ? narrator.name_ml : narratorName!.replace(/\(റ\)\s*$/, '')}</T>
      ) : null}
      {(q || src || book || narratorId || narratorName || narrFilter) && !loading && !error ? (
        <T variant="caption" color="muted" style={{ marginTop: space.md, marginBottom: space.sm }}>
          {semantic ? `"${q}" — ${total} closest by meaning` : `${q ? `"${q}" — ` : ''}${total} results`}
        </T>
      ) : null}
    </Column>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: narrator || narratorName ? 'Narrator' : q ? q : 'Search' }} />
      <FlatList
        data={rows}
        keyExtractor={(h) => String(h.id)}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <Column>
            <HadithListCard h={item} query={semantic ? undefined : hq} index={index % 10} refCount={counts[item.id]} />
          </Column>
        )}
        onEndReachedThreshold={0.6}
        onEndReached={loadMore}
        ListFooterComponent={loading ? <Loading /> : null}
        ListEmptyComponent={
          error ? (
            <ErrorView error={error} onRetry={first.reload} />
          ) : !loading && (q || narrFilter) ? (
            <Empty title="No results" body="Check the spelling or try a shorter word." />
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

function SuggestRow({ icon, label, hint, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; hint?: string; onPress: () => void }) {
  const { colors } = useSettings();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.suggest, { backgroundColor: pressed ? colors.surfaceAlt : 'transparent', borderBottomColor: colors.border }]}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <View style={{ flex: 1 }}>
        <T numberOfLines={1}>{label}</T>
        {hint ? <T variant="tiny" color="faint" numberOfLines={1}>{hint}</T> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 46,
    borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, maxWidth,
  },
});
