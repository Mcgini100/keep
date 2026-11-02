import * as Sharing from 'expo-sharing';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ItemRow } from '../components/ItemRow';
import { Card, Empty, Hairline, Segmented } from '../components/ui';
import { formatBytes } from '../lib/format';
import { useQueue } from '../lib/store';
import type { Item } from '../lib/types';
import { space, type, usePalette } from '../theme';

type Filter = 'all' | 'video' | 'audio';

export function LibraryScreen() {
  const c = usePalette();
  const q = useQueue();
  const [filter, setFilter] = useState<Filter>('all');

  const items = useMemo(
    () => (filter === 'all' ? q.library : q.library.filter((i) => i.kind === filter)),
    [q.library, filter],
  );
  const total = q.library.reduce((n, i) => n + (i.size ?? 0), 0);

  const open = async (item: Item) => {
    if (!item.localUri) return;
    if (!(await Sharing.isAvailableAsync())) return;
    q.tap();
    await Sharing.shareAsync(item.localUri, {
      mimeType: item.kind === 'audio' ? 'audio/mp4' : 'video/mp4',
      dialogTitle: item.title ?? 'Share',
    }).catch(() => {});
  };

  const confirmDelete = (item: Item) => {
    Alert.alert(
      'Delete from Keep?',
      item.savedToPhotos ? 'The copy in your Photos library stays.' : 'This removes the file from your phone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => q.remove(item.id) },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[type.largeTitle, { color: c.text }]}>Library</Text>
      <Text style={[type.callout, { color: c.secondary, marginBottom: space.xl }]}>
        {q.library.length === 0
          ? 'Finished downloads live here.'
          : `${q.library.length} ${q.library.length === 1 ? 'file' : 'files'}${total ? ` · ${formatBytes(total)}` : ''}`}
      </Text>

      {q.library.length > 0 && (
        <View style={{ marginBottom: space.l }}>
          <Segmented
            options={[
              { value: 'all', label: 'All' },
              { value: 'video', label: 'Video' },
              { value: 'audio', label: 'Audio' },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </View>
      )}

      {q.library.length === 0 ? (
        <Empty icon="albums-outline" title="Nothing kept yet" body="Videos are also saved to a “Keep” album in Photos." />
      ) : items.length === 0 ? (
        <Empty icon="search-outline" title={`No ${filter} files`} body="Try another filter." />
      ) : (
        <Card>
          {items.map((it, i) => (
            <View key={it.id}>
              {i > 0 && <Hairline inset={space.l + 64 + space.m} />}
              <Pressable
                onPress={() => open(it)}
                onLongPress={() => confirmDelete(it)}
                accessibilityHint="Opens the share sheet. Long press to delete."
              >
                {({ pressed }) => (
                  <View style={{ opacity: pressed ? 0.6 : 1 }}>
                    <ItemRow
                      item={it}
                      actions={[{ icon: 'share-outline', label: 'Share', onPress: () => open(it), tone: 'accent' }]}
                    />
                  </View>
                )}
              </Pressable>
            </View>
          ))}
        </Card>
      )}
      {items.length > 0 && (
        <Text style={[type.caption, { color: c.tertiary, textAlign: 'center', marginTop: space.l }]}>
          Tap to share or save elsewhere · Long press to delete
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: space.xl, paddingTop: space.l, paddingBottom: space.xxxl },
});
