import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { ArabicText, MalayalamText } from '@/components/hadith';
import { ErrorView, Loading, Screen, T } from '@/components/ui';
import { api } from '@/lib/api';
import { radius, space } from '@/lib/theme';
import { useLoad } from '@/lib/use-load';
import { useSettings } from '@/state/settings';

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, fonts, settings } = useSettings();
  const { data, error, reload } = useLoad(() => api.article(Number(id)), [id]);

  if (error) return <ErrorView error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  return (
    <Screen>
      <Stack.Screen options={{ title: data.article.title_ml }} />
      <T variant="tiny" color="faint" weight="bold" center style={{ marginTop: space.xl }}>Volume {data.article.volume_id}</T>
      <T variant="title" center style={{ marginBottom: space.xl }}>{data.article.title_ml}</T>
      {data.blocks.map((b) => {
        const t = b.text_ml ?? '';
        switch (b.kind) {
          case 'heading':
            return <T key={b.id} variant="heading" style={{ marginTop: space.xl, marginBottom: space.sm, fontFamily: fonts.mlBold }}>{t}</T>;
          case 'subheading':
            return <T key={b.id} weight="bold" style={{ marginTop: space.lg, marginBottom: 4, fontFamily: fonts.mlBold, fontSize: settings.mlSize }}>{t}</T>;
          case 'arabic':
            return <View key={b.id} style={{ marginVertical: space.sm }}><ArabicText text={t} /></View>;
          case 'list_item':
            return (
              <View key={b.id} style={{ flexDirection: 'row', gap: 8, marginVertical: 2 }}>
                <Text style={{ color: colors.accent, fontSize: settings.mlSize }}>•</Text>
                <View style={{ flex: 1 }}><MalayalamText text={t} /></View>
              </View>
            );
          case 'footnote':
            return <View key={b.id} style={{ marginTop: space.sm }}><MalayalamText text={t} muted /></View>;
          case 'table':
            return (
              <View key={b.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, marginVertical: space.md, overflow: 'hidden' }}>
                {(b.rows ?? []).map((r, i) => (
                  <View key={i} style={{ flexDirection: 'row', backgroundColor: i === 0 ? colors.surfaceAlt : colors.surface, borderTopWidth: i ? 1 : 0, borderColor: colors.border }}>
                    {r.map((c, j) => (
                      <View key={j} style={{ flex: 1, padding: 8, borderLeftWidth: j ? 1 : 0, borderColor: colors.border }}>
                        <MalayalamText text={c} />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            );
          default:
            return <View key={b.id} style={{ marginBottom: space.md }}><MalayalamText text={t} /></View>;
        }
      })}
    </Screen>
  );
}
