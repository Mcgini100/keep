import * as Sharing from 'expo-sharing';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ItemRow } from '../components/ItemRow';
import { Card, Empty, Hairline, Segmented, TextButton } from '../components/ui';
import { formatBytes } from '../lib/format';
import { useQueue } from '../lib/store';
import type { Item } from '../lib/types';
import { space, type, usePalette } from '../theme';

type Filter = 'all' | 'video' | 'audio';

export function LibraryScreen() {
  const c = usePalette();
  const q = useQueue();
  const [filter, setFilter] = useState<Filter>('all');
  const [playing, setPlaying] = useState<Item | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const items = useMemo(
    () => (filter === 'all' ? q.library : q.library.filter((i) => i.kind === filter)),
    [q.library, filter],
  );
  const total = q.library.reduce((n, i) => n + (i.size ?? 0), 0);

  const open = (item: Item) => {
    if (!item.localUri) return Alert.alert('File unavailable', 'This download cannot be opened.');
    q.tap();
    setPlaying(item);
  };

  const share = async (item: Item) => {
    if (!item.localUri || !(await Sharing.isAvailableAsync())) {
      Alert.alert('Unable to share', 'Sharing is not available on this device.');
      return;
    }
    try {
      await Sharing.shareAsync(item.localUri, {
        mimeType: item.kind === 'audio' ? 'audio/mp4' : 'video/mp4',
        dialogTitle: item.title ?? 'Share',
      });
    } catch (error) {
      Alert.alert('Unable to share', (error as Error).message || 'Please try again.');
    }
  };

  const saveGallery = async (item: Item) => {
    if (savingId) return;
    setSavingId(item.id);
    try {
      await q.saveItemToGallery(item);
      Alert.alert('Saved to Gallery', 'Find this video in the Keep album.');
    } catch (error) {
      Alert.alert('Could not save to Gallery', (error as Error).message || 'Please try again.');
    } finally {
      setSavingId(null);
    }
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
    <>
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
        <Empty icon="albums-outline" title="Nothing kept yet" body="Play your downloads here or save videos to Gallery." />
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
                accessibilityHint="Play this file. Long press to delete."
              >
                {({ pressed }) => (
                  <View style={{ opacity: pressed ? 0.6 : 1 }}>
                    <ItemRow
                      item={it}
                      actions={[
                        ...(it.kind === 'video' ? [{ icon: 'download-outline' as const, label: 'Save to Gallery', onPress: () => saveGallery(it) }] : []),
                        { icon: 'share-outline', label: 'Share', onPress: () => share(it), tone: 'accent' },
                      ]}
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
          Tap to play · Use the icons to save or share · Long press to delete
        </Text>
      )}
    </ScrollView>
    <Modal visible={!!playing} animationType="slide" onRequestClose={() => setPlaying(null)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <View style={styles.playerHeader}>
          <Text numberOfLines={1} style={[type.headline, { color: c.text, flex: 1 }]}>{playing?.title || 'Playback'}</Text>
          <TextButton label="Done" onPress={() => setPlaying(null)} />
        </View>
        {playing?.localUri && <Player uri={playing.localUri} />}
      </SafeAreaView>
    </Modal>
    </>
  );
}

function Player({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => instance.play());
  React.useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error') Alert.alert('Unable to play', error?.message || 'This file could not be played.');
    });
    return () => subscription.remove();
  }, [player]);
  return <VideoView player={player} nativeControls contentFit="contain" style={{ flex: 1, backgroundColor: '#000' }} />;
}

const styles = StyleSheet.create({
  playerHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.l, paddingVertical: space.m, gap: space.m },
  container: { paddingHorizontal: space.xl, paddingTop: space.l, paddingBottom: space.xxxl },
});
