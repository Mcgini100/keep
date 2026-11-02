import * as Clipboard from 'expo-clipboard';
import React, { useMemo, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { IconButton, PlatformMark, PrimaryButton, Segmented, SectionLabel, TextButton } from '../components/ui';
import { extractLinks, prettyUrl } from '../lib/links';
import { useQueue } from '../lib/store';
import type { Kind, Quality } from '../lib/types';
import { radius, space, type, usePalette } from '../theme';

const QUALITIES: { value: Quality; label: string }[] = [
  { value: 'best', label: 'Best' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' },
];

export function AddScreen({
  onOpenSettings,
  onQueued,
  text,
  setText,
}: {
  onOpenSettings: () => void;
  onQueued: () => void;
  text: string;
  setText: (t: string) => void;
}) {
  const c = usePalette();
  const q = useQueue();
  const [kind, setKind] = useState<Kind>(q.settings.kind);
  const [quality, setQuality] = useState<Quality>(q.settings.quality);
  const [notice, setNotice] = useState<string | null>(null);

  const links = useMemo(() => extractLinks(text), [text]);
  const valid = links.filter((l) => l.platform);
  const noServer = !q.settings.serverUrl.trim();

  const paste = async () => {
    const clip = await Clipboard.getStringAsync();
    if (!clip) return setNotice('Clipboard is empty.');
    setText(text ? `${text.trimEnd()}\n${clip}` : clip);
    setNotice(null);
    q.tap();
  };

  const add = () => {
    Keyboard.dismiss();
    const added = q.enqueue(valid, kind, quality);
    if (added === 0) {
      setNotice('Those links are already in your queue.');
      return;
    }
    q.tap('success');
    setText('');
    setNotice(null);
    onQueued();
  };

  const ctaLabel =
    valid.length === 0 ? 'Add to queue' : valid.length === 1 ? 'Download' : `Download ${valid.length} in order`;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <View style={styles.header}>
        <Text style={[type.largeTitle, { color: c.text }]}>Keep</Text>
        <IconButton name="settings-outline" label="Settings" onPress={onOpenSettings} />
      </View>
      <Text style={[type.callout, { color: c.secondary, marginBottom: space.xl }]}>
        Paste one link or many. They'll download one after another.
      </Text>

      <View style={[styles.input, { backgroundColor: c.surface }]}>
        <TextInput
          value={text}
          onChangeText={(t) => {
            setText(t);
            setNotice(null);
          }}
          placeholder={'youtube.com/watch?v=…\ninstagram.com/reel/…'}
          placeholderTextColor={c.tertiary}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={[type.body, styles.textInput, { color: c.text }]}
          accessibilityLabel="Links to download"
        />
        <View style={styles.inputBar}>
          <TextButton label="Paste" onPress={paste} />
          {text ? <TextButton label="Clear" tone="secondary" onPress={() => setText('')} /> : null}
        </View>
      </View>

      {links.length > 0 && (
        <View style={{ marginTop: space.l }}>
          {links.map((l) => (
            <View key={l.url} style={styles.link}>
              <PlatformMark platform={l.platform} />
              <Text
                numberOfLines={1}
                style={[type.caption, { color: l.platform ? c.text : c.tertiary, flex: 1, marginLeft: space.s }]}
              >
                {prettyUrl(l.url)}
              </Text>
              {!l.platform && <Text style={[type.caption, { color: c.tertiary }]}>Not supported</Text>}
            </View>
          ))}
        </View>
      )}

      <SectionLabel>Format</SectionLabel>
      <Segmented
        options={[
          { value: 'video', label: 'Video' },
          { value: 'audio', label: 'Audio only' },
        ]}
        value={kind}
        onChange={(v) => {
          setKind(v);
          q.tap();
        }}
      />

      {kind === 'video' && (
        <>
          <SectionLabel>Quality</SectionLabel>
          <Segmented
            options={QUALITIES}
            value={quality}
            onChange={(v) => {
              setQuality(v);
              q.tap();
            }}
          />
        </>
      )}

      <View style={{ marginTop: space.xxl }}>
        <PrimaryButton label={ctaLabel} onPress={add} disabled={valid.length === 0} />
        {notice ? (
          <Text style={[type.caption, styles.note, { color: c.secondary }]}>{notice}</Text>
        ) : noServer ? (
          <Text style={[type.caption, styles.note, { color: c.secondary }]}>
            Set your download engine address in{' '}
            <Text style={{ color: c.accent }} onPress={onOpenSettings}>
              Settings
            </Text>{' '}
            first.
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: space.xl, paddingTop: space.l, paddingBottom: space.xxxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.xs },
  input: { borderRadius: radius.l, padding: space.l, paddingBottom: space.m },
  textInput: { minHeight: 120, maxHeight: 240, textAlignVertical: 'top', padding: 0 },
  inputBar: { flexDirection: 'row', gap: space.xl, marginTop: space.m },
  link: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  note: { textAlign: 'center', marginTop: space.m },
});
