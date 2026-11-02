import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatBytes, formatDuration, formatSpeed, relativeTime } from '../lib/format';
import { prettyUrl } from '../lib/links';
import type { Item } from '../lib/types';
import { space, type, usePalette } from '../theme';
import { IconButton, ProgressBar, Thumb } from './ui';

function statusLine(item: Item): string {
  switch (item.status) {
    case 'pending':
      return `Waiting · ${item.kind === 'audio' ? 'Audio' : item.quality === 'best' ? 'Best quality' : `${item.quality}p`}`;
    case 'fetching': {
      const pct = Math.round(item.progress * 100);
      const speed = formatSpeed(item.speed);
      return `Fetching · ${pct}%${speed ? ` · ${speed}` : ''}`;
    }
    case 'saving':
      return `Saving to phone · ${Math.round(item.progress * 100)}%`;
    case 'done':
      return [
        item.kind === 'audio' ? 'Audio' : 'Video',
        formatDuration(item.duration),
        formatBytes(item.size),
        relativeTime(item.finishedAt),
      ]
        .filter(Boolean)
        .join(' · ');
    case 'failed':
      return item.error || 'Failed';
    case 'cancelled':
      return 'Cancelled';
  }
}

export function ItemRow({
  item,
  actions,
  large,
}: {
  item: Item;
  actions?: { icon: React.ComponentProps<typeof IconButton>['name']; label: string; onPress: () => void; tone?: 'secondary' | 'accent' | 'danger' }[];
  large?: boolean;
}) {
  const c = usePalette();
  const active = item.status === 'fetching' || item.status === 'saving';
  const failed = item.status === 'failed';
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Thumb uri={item.thumbnail} platform={item.platform} width={large ? 96 : 64} audio={item.kind === 'audio'} />
        <View style={styles.text}>
          <Text numberOfLines={2} style={[type.callout, { color: c.text, fontWeight: '500' }]}>
            {item.title || prettyUrl(item.url)}
          </Text>
          <Text numberOfLines={2} style={[type.caption, { color: failed ? c.danger : c.secondary, marginTop: 3 }]}>
            {statusLine(item)}
          </Text>
        </View>
        {actions?.length ? (
          <View style={styles.actions}>
            {actions.map((a) => (
              <IconButton key={a.label} name={a.icon} label={a.label} onPress={a.onPress} tone={a.tone} />
            ))}
          </View>
        ) : null}
      </View>
      {active && (
        <View style={{ marginTop: space.m }}>
          <ProgressBar value={item.progress} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: space.m, paddingHorizontal: space.l },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, marginLeft: space.m },
  actions: { flexDirection: 'row', gap: space.l, marginLeft: space.m },
});
