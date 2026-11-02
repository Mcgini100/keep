import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Hairline, Row, Segmented, SectionLabel, TextButton, ToggleRow } from '../components/ui';
import { api } from '../lib/api';
import { useQueue } from '../lib/store';
import type { Kind, Quality } from '../lib/types';
import { space, type, usePalette } from '../theme';

type Check = { state: 'idle' | 'checking' | 'ok' | 'fail'; message?: string };

export function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = usePalette();
  const q = useQueue();
  const s = q.settings;
  const [check, setCheck] = useState<Check>({ state: 'idle' });

  const test = async () => {
    setCheck({ state: 'checking' });
    try {
      const h = await api.health(s);
      const warn = !h.ffmpeg ? ' · ffmpeg missing' : h.auth && !s.apiKey ? ' · needs access key' : '';
      setCheck({ state: warn ? 'fail' : 'ok', message: `Connected · yt-dlp ${h.yt_dlp}${warn}` });
      q.tap(warn ? 'error' : 'success');
    } catch (e) {
      setCheck({ state: 'fail', message: (e as Error).message });
      q.tap('error');
    }
  };

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    secure = false,
  ) => (
    <View style={styles.field}>
      <Text style={[type.caption, { color: c.secondary, marginBottom: 4 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(v) => {
          onChange(v);
          setCheck({ state: 'idle' });
        }}
        placeholder={placeholder}
        placeholderTextColor={c.tertiary}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={secure}
        keyboardType={secure ? 'default' : 'url'}
        style={[type.body, { color: c.text, paddingVertical: 4 }]}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
        <View style={styles.bar}>
          <Text style={[type.headline, { color: c.text }]}>Settings</Text>
          <View style={styles.done}>
            <TextButton label="Done" onPress={onClose} style={{ fontWeight: '600' }} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <SectionLabel>Download engine</SectionLabel>
          <Card>
            {field('Address', s.serverUrl, (v) => q.updateSettings({ serverUrl: v }), 'https://keep.example.com')}
            <Hairline inset={space.l} />
            {field('Access key (optional)', s.apiKey, (v) => q.updateSettings({ apiKey: v }), 'Matches KEEP_API_KEY', true)}
            <Hairline inset={space.l} />
            <Row
              label="Test connection"
              detail={check.message ?? (check.state === 'checking' ? 'Checking…' : undefined)}
              onPress={test}
            >
              <Text
                style={[
                  type.caption,
                  { color: check.state === 'ok' ? c.success : check.state === 'fail' ? c.danger : c.accent },
                ]}
              >
                {check.state === 'ok' ? 'Connected' : check.state === 'fail' ? 'Problem' : 'Test'}
              </Text>
            </Row>
          </Card>
          <Text style={[type.caption, styles.foot, { color: c.secondary }]}>
            Keep sends links to your own engine, which does the heavy lifting and hands back a clean file. See the
            README to run it with one Docker command.
          </Text>

          <SectionLabel>Defaults</SectionLabel>
          <Text style={[type.caption, { color: c.secondary, marginBottom: space.s }]}>Format</Text>
          <Segmented<Kind>
            options={[
              { value: 'video', label: 'Video' },
              { value: 'audio', label: 'Audio only' },
            ]}
            value={s.kind}
            onChange={(v) => q.updateSettings({ kind: v })}
          />
          <Text style={[type.caption, { color: c.secondary, marginBottom: space.s, marginTop: space.l }]}>Quality</Text>
          <Segmented<Quality>
            options={[
              { value: 'best', label: 'Best' },
              { value: '1080', label: '1080p' },
              { value: '720', label: '720p' },
              { value: '480', label: '480p' },
              { value: '360', label: '360p' },
            ]}
            value={s.quality}
            onChange={(v) => q.updateSettings({ quality: v })}
          />

          <SectionLabel>Behaviour</SectionLabel>
          <Card>
            <ToggleRow
              label="Save videos to Photos"
              detail="Into an album called “Keep”."
              value={s.saveToPhotos}
              onChange={(v) => q.updateSettings({ saveToPhotos: v })}
            />
            <Hairline inset={space.l} />
            <ToggleRow
              label="Offer copied links"
              detail="When you open Keep with a link on the clipboard."
              value={s.watchClipboard}
              onChange={(v) => q.updateSettings({ watchClipboard: v })}
            />
            <Hairline inset={space.l} />
            <ToggleRow label="Haptics" value={s.haptics} onChange={(v) => q.updateSettings({ haptics: v })} />
          </Card>

          <Text style={[type.caption, styles.foot, { color: c.tertiary, textAlign: 'center', marginTop: space.xxl }]}>
            Only download content you own or have permission to save.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, alignItems: 'center', justifyContent: 'center' },
  done: { position: 'absolute', right: space.xl, top: 0, bottom: 0, justifyContent: 'center' },
  container: { paddingHorizontal: space.xl, paddingBottom: space.xxxl },
  field: { paddingHorizontal: space.l, paddingVertical: space.m },
  foot: { marginTop: space.s, lineHeight: 18 },
});
