import * as Clipboard from 'expo-clipboard';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ItemRow } from '../components/ItemRow';
import { Card, Empty, Hairline, SectionLabel, TextButton } from '../components/ui';
import { useQueue } from '../lib/store';
import type { Item } from '../lib/types';
import { space, type, usePalette } from '../theme';

function showDetails(item: Item, version: string | null) {
  const detail = item.errorDetail || item.error || 'No details.';
  const report = [`Keep · yt-dlp ${version ?? 'unknown'}`, item.url, '', detail].join('\n');
  Alert.alert(item.error || 'Download failed', detail.length > 600 ? `${detail.slice(0, 600)}…` : detail, [
    { text: 'Copy details', onPress: () => Clipboard.setStringAsync(report) },
    { text: 'OK', style: 'cancel' },
  ]);
}

export function QueueScreen() {
  const c = usePalette();
  const q = useQueue();
  const empty = !q.current && q.pending.length === 0 && q.finished.length === 0;
  const remaining = (q.current ? 1 : 0) + q.pending.length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={[type.largeTitle, { color: c.text }]}>Queue</Text>
        {remaining > 0 && (
          <TextButton
            label={q.paused ? 'Resume' : 'Pause'}
            onPress={() => {
              q.setPaused(!q.paused);
              q.tap();
            }}
          />
        )}
      </View>
      <Text style={[type.callout, { color: c.secondary }]}>
        {remaining === 0
          ? 'Nothing waiting.'
          : q.paused
            ? `Paused · ${remaining} waiting`
            : `${remaining} ${remaining === 1 ? 'item' : 'items'} · one at a time`}
      </Text>

      {empty && (
        <Empty icon="arrow-down-circle-outline" title="Your queue is clear" body="Links you add will line up here and download in order." />
      )}

      {q.current && (
        <>
          <SectionLabel>Now</SectionLabel>
          <Card>
            <ItemRow
              item={q.current}
              large
              actions={[{ icon: 'close', label: 'Cancel', onPress: () => q.cancel(q.current!.id) }]}
            />
          </Card>
        </>
      )}

      {q.pending.length > 0 && (
        <>
          <SectionLabel>Up next</SectionLabel>
          <Card>
            {q.pending.map((it, i) => (
              <View key={it.id}>
                {i > 0 && <Hairline inset={space.l + 64 + space.m} />}
                <ItemRow
                  item={it}
                  actions={[
                    ...(i > 0
                      ? [{ icon: 'arrow-up' as const, label: 'Move to top', onPress: () => q.moveToTop(it.id) }]
                      : []),
                    { icon: 'close' as const, label: 'Remove', onPress: () => q.remove(it.id) },
                  ]}
                />
              </View>
            ))}
          </Card>
        </>
      )}

      {q.finished.length > 0 && (
        <>
          <SectionLabel
            right={
              <View style={{ flexDirection: 'row', gap: space.l }}>
                <TextButton label="Retry all" onPress={q.retryFailed} />
                <TextButton label="Clear" tone="secondary" onPress={q.clearFinished} />
              </View>
            }
          >
            Didn't finish
          </SectionLabel>
          <Text style={[type.caption, { color: c.tertiary, marginBottom: space.s }]}>Tap one to see what went wrong.</Text>
          <Card>
            {q.finished.map((it, i) => (
              <View key={it.id}>
                {i > 0 && <Hairline inset={space.l + 64 + space.m} />}
                <Pressable
                  onPress={() => it.status === 'failed' && showDetails(it, q.engine.version)}
                  accessibilityHint="Shows the full error"
                >
                  {({ pressed }) => (
                    <View style={{ opacity: pressed ? 0.6 : 1 }}>
                      <ItemRow
                        item={it}
                        actions={[
                          { icon: 'refresh', label: 'Retry', onPress: () => q.retry(it.id), tone: 'accent' },
                          { icon: 'close', label: 'Remove', onPress: () => q.remove(it.id) },
                        ]}
                      />
                    </View>
                  )}
                </Pressable>
              </View>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: space.xl, paddingTop: space.l, paddingBottom: space.xxxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.xs },
});
