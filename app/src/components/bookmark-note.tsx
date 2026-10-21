import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';

import { radius, space } from '@/lib/theme';
import { useLibrary } from '@/state/library';
import { useSettings } from '@/state/settings';

import { Chip, IconButton, Row, T, useUiFont } from './ui';

/** Personal note on a bookmarked hadith (stays on this device). Renders nothing if the hadith isn't bookmarked. */
export function BookmarkNote({ id }: { id: number }) {
  const { bookmarks, setNote } = useLibrary();
  const { colors, fonts } = useSettings();
  const font = useUiFont();
  const b = bookmarks.find((x) => x.id === id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  if (!b) return null;

  const start = () => {
    setDraft(b.note ?? '');
    setEditing(true);
  };
  const save = () => {
    setNote(id, draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <View style={[styles.box, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          autoFocus
          multiline
          maxLength={1000}
          placeholder="Write a note…"
          placeholderTextColor={colors.textFaint}
          style={[{ minHeight: 70, fontSize: 16, color: colors.text, fontFamily: fonts.ml, textAlignVertical: 'top' }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
        />
        <Row style={{ justifyContent: 'flex-end', marginTop: space.sm }}>
          <Chip label="Cancel" onPress={() => setEditing(false)} />
          <Chip label="Save note" icon="checkmark" active onPress={save} />
        </Row>
      </View>
    );
  }

  if (!b.note) {
    return <Chip label="Add a note" icon="create-outline" onPress={start} style={{ alignSelf: 'flex-start', marginTop: space.sm }} />;
  }
  return (
    <View style={[styles.box, { backgroundColor: colors.goldSoft, borderColor: colors.gold + '55' }]}>
      <Row style={{ alignItems: 'flex-start' }}>
        <T style={{ flex: 1, fontFamily: font('regular') }}>{b.note}</T>
        <IconButton name="create-outline" label="Edit note" size={20} onPress={start} />
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, padding: space.md, marginTop: space.sm },
});
