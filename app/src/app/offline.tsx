import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Appear, Skeleton } from '@/components/motion';
import { Card, Chip, Divider, Empty, ErrorView, Row, Screen, T } from '@/components/ui';
import { api } from '@/lib/api';
import { downloadBook } from '@/lib/offline-download';
import { downloadedBooks, offlineSupported, onOfflineChange, PackInfo, removePack } from '@/lib/offline';
import { space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useSettings } from '@/state/settings';
import { friendlyError } from '@/lib/errors';

const mb = (b: number) => (b < 1e5 ? `${Math.max(1, Math.round(b / 1e3))} KB` : `${(b / 1e6).toFixed(1)} MB`);

export default function OfflineScreen() {
  const { colors } = useSettings();
  const books = useLoad(() => api.books(), []);
  const [packs, setPacks] = useState<PackInfo[]>([]);
  const [busy, setBusy] = useState<Record<number, number>>({}); // bookId -> progress 0..1
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(() => downloadedBooks().then(setPacks), []);
  useEffect(() => {
    refresh();
    return onOfflineChange(() => void refresh());
  }, [refresh]);

  if (!offlineSupported) {
    return (
      <Screen>
        <Empty icon="phone-portrait-outline" title="Offline reading is in the phone app" body="Install the Android or iOS app to download books." />
      </Screen>
    );
  }
  if (books.error) return <ErrorView error={books.error} onRetry={books.reload} />;
  if (!books.data) return <Screen>{[0, 1, 2, 3].map((i) => <Skeleton key={i} style={{ height: 64, borderRadius: 16, backgroundColor: colors.surfaceAlt, marginBottom: 12 }} />)}</Screen>;

  const have = new Map(packs.map((p) => [p.bookId, p]));
  const withHadith = books.data.filter((b) => b.hadith_count > 0);
  const totalBytes = packs.reduce((a, p) => a + p.bytes, 0);

  async function get(id: number) {
    setError('');
    setNotice('');
    setBusy((s) => ({ ...s, [id]: 0 }));
    try {
      await downloadBook(id, (f) => setBusy((s) => ({ ...s, [id]: f })));
      setNotice('Saved to this device. You can read it without internet.');
    } catch (e) {
      setNotice('');
      setError(friendlyError(e));
    } finally {
      setBusy((s) => {
        const { [id]: _, ...rest } = s;
        return rest;
      });
    }
  }

  async function getAll() {
    for (const b of withHadith) if (!have.has(b.id)) await get(b.id);
  }

  const volumes = [...new Set(withHadith.map((b) => b.volume_id))];
  return (
    <Screen contentStyle={{ paddingTop: space.md }}>
      <Appear><T variant="heading">Offline books</T></Appear>
      <Appear index={1}>
        <T color="muted" style={{ marginTop: 2 }}>
          Download a book to read it without internet. Search and AI answers still need a connection.
        </T>
      </Appear>
      <Appear index={2}>
        <Row style={{ marginTop: space.lg, justifyContent: 'space-between' }}>
          <T variant="caption" color="muted">{packs.length} downloaded{totalBytes ? ` · ${mb(totalBytes)}` : ''}</T>
          {packs.length < withHadith.length && Object.keys(busy).length === 0 ? (
            <Chip label="Download all" icon="download-outline" onPress={getAll} />
          ) : null}
        </Row>
      </Appear>
      {error ? <T color="danger" style={{ marginTop: space.sm }}>{error}</T> : null}
      {notice ? <T color="accent" style={{ marginTop: space.sm }}>{notice}</T> : null}

      {volumes.map((v) => (
        <View key={v} style={{ marginTop: space.xl }}>
          <T variant="tiny" color="faint" weight="bold" style={{ letterSpacing: 0.6, marginBottom: space.sm }}>VOLUME {v}</T>
          <Card style={{ padding: 0 }}>
            {withHadith.filter((b) => b.volume_id === v).map((b, i, arr) => {
              const p = have.get(b.id);
              const prog = busy[b.id];
              return (
                <View key={b.id}>
                  <Row style={{ padding: space.md }}>
                    <View style={{ flex: 1 }}>
                      <T weight="medium" numberOfLines={2}>{b.title_ml}</T>
                      <T variant="tiny" color="faint">
                        {b.hadith_count} hadith{p ? ` · ${mb(p.bytes)}` : ''}
                      </T>
                    </View>
                    {prog !== undefined ? (
                      <Row gap={6}>
                        <ActivityIndicator size="small" color={colors.accent} />
                        <T variant="caption" color="muted">{Math.round(prog * 100)}%</T>
                      </Row>
                    ) : p ? (
                      <Row gap={4}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                        <Chip label="Remove" onPress={() => removePack(b.id)} />
                      </Row>
                    ) : (
                      <Chip label="Download" icon="download-outline" onPress={() => get(b.id)} />
                    )}
                  </Row>
                  {i < arr.length - 1 ? <Divider /> : null}
                </View>
              );
            })}
          </Card>
        </View>
      ))}
    </Screen>
  );
}
