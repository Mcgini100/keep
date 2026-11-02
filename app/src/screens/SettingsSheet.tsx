import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Engine, engineAvailable } from '../../modules/keep-engine';
import { Card, Hairline, Row, Segmented, SectionLabel, TextButton, ToggleRow } from '../components/ui';
import { useQueue } from '../lib/store';
import type { Kind, Quality } from '../lib/types';
import { space, type, usePalette } from '../theme';
import { InstagramSignIn } from './InstagramSignIn';

export function SettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const c = usePalette();
  const q = useQueue();
  const s = q.settings;
  const [igSignedIn, setIgSignedIn] = useState(false);
  const [igSheet, setIgSheet] = useState(false);

  useEffect(() => {
    if (visible) Engine.instagramCookies().then((v) => setIgSignedIn(!!v)).catch(() => {});
  }, [visible]);

  const e = q.engine;
  const busy = e.status === 'starting' || e.status === 'updating';
  const engineDetail =
    e.status === 'unavailable'
      ? 'Runs on Android only.'
      : e.status === 'starting'
        ? 'Starting…'
        : e.status === 'updating'
          ? 'Checking for updates…'
          : e.status === 'error'
            ? e.message || "Couldn't start."
            : [e.version ? `yt-dlp ${e.version}` : null, e.message].filter(Boolean).join(' · ');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
        <View style={styles.bar}>
          <Text style={[type.headline, { color: c.text }]}>Settings</Text>
          <View style={styles.done}>
            <TextButton label="Done" onPress={onClose} style={{ fontWeight: '600' }} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.container}>
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

          <SectionLabel>Instagram</SectionLabel>
          <Card>
            <Row
              label={igSignedIn ? 'Signed in' : 'Sign in'}
              detail={
                igSignedIn
                  ? 'Reels and posts download as your account.'
                  : 'Optional. Makes Instagram downloads far more reliable.'
              }
            >
              {igSignedIn ? (
                <TextButton
                  label="Sign out"
                  tone="danger"
                  onPress={async () => {
                    await Engine.signOutInstagram();
                    setIgSignedIn(false);
                    q.tap();
                  }}
                />
              ) : (
                <TextButton label="Sign in" onPress={() => setIgSheet(true)} disabled={!engineAvailable} />
              )}
            </Row>
          </Card>

          <SectionLabel>Behaviour</SectionLabel>
          <Card>
            <ToggleRow
              label="Save videos to Gallery"
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

          <SectionLabel>Engine</SectionLabel>
          <Card>
            <Row label="Download engine" detail={engineDetail}>
              {busy ? (
                <ActivityIndicator color={c.secondary} />
              ) : e.status === 'ready' ? (
                <TextButton label="Update" onPress={q.updateEngine} />
              ) : null}
            </Row>
          </Card>
          <Text style={[type.caption, styles.foot, { color: c.secondary }]}>
            Everything happens on this phone. Keep updates its engine once a day so YouTube and Instagram keep working.
          </Text>

          <Text style={[type.caption, styles.foot, { color: c.tertiary, textAlign: 'center', marginTop: space.xxl }]}>
            Only download content you own or have permission to save.
          </Text>
        </ScrollView>
      </SafeAreaView>

      <InstagramSignIn
        visible={igSheet}
        onClose={(ok) => {
          setIgSheet(false);
          if (ok) {
            setIgSignedIn(true);
            q.tap('success');
          }
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, alignItems: 'center', justifyContent: 'center' },
  done: { position: 'absolute', right: space.xl, top: 0, bottom: 0, justifyContent: 'center' },
  container: { paddingHorizontal: space.xl, paddingBottom: space.xxxl },
  foot: { marginTop: space.s, lineHeight: 18 },
});
