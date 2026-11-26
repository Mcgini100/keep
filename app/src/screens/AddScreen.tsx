import * as Clipboard from 'expo-clipboard';
import React, { useMemo, useRef, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { IconButton, PlatformMark, PrimaryButton, ScreenTitle, Segmented, SectionLabel, TextButton } from '../components/ui';
import { extractLinks, prettyUrl } from '../lib/links';
import { appendClipboard, newlineAfterLinkInsertion } from '../lib/paste';
import { useQueue } from '../lib/store';
import type { Kind, Quality } from '../lib/types';
import { DOCK_CLEARANCE, fonts, radius, space, type, usePalette } from '../theme';

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
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const selection = useRef({ start: 0, end: 0 });

  const links = useMemo(() => extractLinks(text), [text]);
  const valid = links.filter((l) => l.platform);
  const engineNote =
    q.engine.status === 'unavailable'
      ? 'Downloads run in the Android app. Install the Keep APK.'
      : q.engine.status === 'error'
        ? `The download engine couldn't start. ${q.engine.message ?? ''}`.trim()
        : q.engine.status === 'starting'
          ? 'Setting up the download engine — first launch takes a moment.'
          : null;

  const paste = async () => {
    const clip = await Clipboard.getStringAsync();
    if (!clip) return setNotice('Clipboard is empty.');
    const next = appendClipboard(text, clip);
    setText(next);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setNativeProps({ selection: { start: next.length, end: next.length } });
    });
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
    valid.length === 0 ? 'Add to queue' : valid.length === 1 ? 'Download' : `Download ${valid.length}`;
  const atOnce = q.settings.concurrency;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <ScreenTitle
        kicker="No. 01 — Add"
        title="Keep"
        right={<IconButton name="settings-outline" label="Settings" onPress={onOpenSettings} tone="text" />}
      />
      <Text style={[styles.tagline, { color: c.text }]}>
        Save what you love,{' '}
        <Text style={{ fontFamily: fonts.displayItalic, color: c.accent }}>on your phone.</Text>
      </Text>
      <Text style={[type.callout, { color: c.secondary, marginTop: space.m }]}>
        Paste one link or a whole list.{' '}
        {atOnce === 1 ? 'They download one after another.' : `Up to ${atOnce} download at once.`}
      </Text>
      <Text style={[type.micro, { color: c.tertiary, marginTop: space.m, marginBottom: space.xl }]}>
        YOUTUBE · INSTAGRAM · X
      </Text>

      <View style={[styles.input, { backgroundColor: c.surfaceRaised, borderColor: c.hairline }]}>
        <TextInput
          ref={inputRef}
          value={text}
          onSelectionChange={({ nativeEvent }) => { selection.current = nativeEvent.selection; }}
          onChangeText={(t) => {
            const { start, end } = selection.current;
            const insertion = newlineAfterLinkInsertion(text, t, start, end, (value) => extractLinks(value).some((link) => !!link.platform));
            setText(insertion?.text ?? t);
            if (insertion) requestAnimationFrame(() =>
              inputRef.current?.setNativeProps({ selection: { start: insertion.cursor, end: insertion.cursor } }),
            );
            setNotice(null);
          }}
          placeholder={'youtube.com/watch?v=…\ninstagram.com/reel/…\nx.com/user/status/…'}
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
        ) : engineNote ? (
          <Text style={[type.caption, styles.note, { color: c.secondary }]}>{engineNote}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: space.xl, paddingTop: space.l, paddingBottom: DOCK_CLEARANCE },
  tagline: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  input: { borderRadius: radius.l, borderWidth: 1, padding: space.l, paddingBottom: space.m },
  textInput: { minHeight: 120, maxHeight: 240, textAlignVertical: 'top', padding: 0 },
  inputBar: { flexDirection: 'row', gap: space.xl, marginTop: space.m },
  link: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  note: { textAlign: 'center', marginTop: space.m },
});
