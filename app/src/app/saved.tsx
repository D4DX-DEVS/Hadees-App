import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { BookmarkNote } from '@/components/bookmark-note';
import { HadithListCard } from '@/components/hadith';
import { Card, Chip, Divider, Empty, IconButton, Row, Screen, SectionTitle, T } from '@/components/ui';
import { space } from '@/lib/theme';
import { useLibrary } from '@/state/library';
import { useSettings } from '@/state/settings';

type Tab = 'bookmarks' | 'history' | 'searches';

export default function SavedScreen() {
  const { colors } = useSettings();
  const { bookmarks, reads, searches, toggleBookmark, removeSearch, clearSearches, clearReads } = useLibrary();
  const [tab, setTab] = useState<Tab>('bookmarks');
  const [book, setBook] = useState<string | null>(null);

  const books = useMemo(() => [...new Set(bookmarks.map((b) => b.book_title_ml))], [bookmarks]);
  const shown = book ? bookmarks.filter((b) => b.book_title_ml === book) : bookmarks;

  return (
    <Screen contentStyle={{ paddingTop: space.md }}>
      <T color="muted">Stored on this device only</T>

      <Row style={{ marginTop: space.lg }}>
        <Chip label={`Bookmarks ${bookmarks.length}`} icon="bookmark-outline" active={tab === 'bookmarks'} onPress={() => setTab('bookmarks')} />
        <Chip label="History" icon="time-outline" active={tab === 'history'} onPress={() => setTab('history')} />
        <Chip label="Searches" icon="search-outline" active={tab === 'searches'} onPress={() => setTab('searches')} />
      </Row>

      {tab === 'bookmarks' &&
        (bookmarks.length === 0 ? (
          <Empty icon="bookmark-outline" title="No bookmarks yet" body="Tap the bookmark icon while reading a hadith to keep it here." />
        ) : (
          <>
            {books.length > 1 && (
              <Row wrap style={{ marginTop: space.md }}>
                <Chip label="All" active={!book} onPress={() => setBook(null)} />
                {books.map((b) => <Chip key={b} label={b} active={book === b} onPress={() => setBook(b)} />)}
              </Row>
            )}
            <View style={{ marginTop: space.lg }}>
              {shown.map((b) => (
                <View key={b.id} style={{ marginBottom: space.xl }}>
                  <HadithListCard h={b} index={shown.indexOf(b)} />
                  <Row style={{ justifyContent: 'space-between', marginTop: -space.xs }}>
                    <View style={{ flex: 1 }}><BookmarkNote id={b.id} /></View>
                    <Chip label="Remove" icon="trash-outline" onPress={() => toggleBookmark(b)} style={{ marginTop: space.sm }} />
                  </Row>
                </View>
              ))}
            </View>
          </>
        ))}

      {tab === 'history' &&
        (reads.length === 0 ? (
          <Empty icon="time-outline" title="No reading history" />
        ) : (
          <>
            <SectionTitle action={<Chip label="Clear" icon="trash-outline" onPress={clearReads} />}>Recently read</SectionTitle>
            {reads.map((r, i) => <HadithListCard key={r.id} h={r} index={i} />)}
          </>
        ))}

      {tab === 'searches' &&
        (searches.length === 0 ? (
          <Empty icon="search-outline" title="No searches yet" />
        ) : (
          <>
            <SectionTitle action={<Chip label="Clear" icon="trash-outline" onPress={clearSearches} />}>Recent searches</SectionTitle>
            <Card padded={false}>
              {searches.map((s, i) => (
                <View key={s.q}>
                  {i > 0 && <Divider />}
                  <Pressable
                    onPress={() => router.push({ pathname: '/search', params: { q: s.q } })}
                    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 12, paddingHorizontal: space.lg }, pressed && { backgroundColor: colors.surfaceAlt }]}>
                    <Ionicons name={s.mode === 'ask' ? 'sparkles-outline' : 'search-outline'} size={16} color={colors.textMuted} />
                    <T style={{ flex: 1 }} numberOfLines={1}>{s.q}</T>
                    <IconButton name="close" size={16} label="Remove" onPress={() => removeSearch(s.q)} />
                  </Pressable>
                </View>
              ))}
            </Card>
          </>
        ))}
    </Screen>
  );
}
