import React, { useRef } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { Engine } from '../../modules/keep-engine';
import { TextButton } from '../components/ui';
import { space, type, usePalette } from '../theme';

const LOGIN_URL = 'https://www.instagram.com/accounts/login/';

/**
 * Signs in on Instagram's own page. Keep never sees the password — it only
 * reuses the session cookie the page sets, so yt-dlp can fetch reels and
 * posts the way the Instagram app would.
 */
export function InstagramSignIn({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: (signedIn: boolean) => void;
}) {
  const c = usePalette();
  const done = useRef(false);

  const check = async () => {
    if (done.current) return;
    const cookies = await Engine.instagramCookies();
    if (cookies) {
      done.current = true;
      onClose(true);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={() => {
        done.current = false;
      }}
      onRequestClose={() => onClose(false)}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
        <View style={styles.bar}>
          <Text style={[type.headline, { color: c.text }]}>Instagram</Text>
          <View style={styles.done}>
            <TextButton label="Close" onPress={() => onClose(false)} />
          </View>
        </View>
        <Text style={[type.caption, styles.note, { color: c.secondary }]}>
          Sign in on Instagram's page. Keep only keeps the session, never your password.
        </Text>
        {visible && (
          <WebView
            source={{ uri: LOGIN_URL }}
            style={{ flex: 1 }}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            onNavigationStateChange={(nav) => {
              if (!nav.loading) check();
            }}
            onLoadEnd={check}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, alignItems: 'center', justifyContent: 'center' },
  done: { position: 'absolute', right: space.xl, top: 0, bottom: 0, justifyContent: 'center' },
  note: { textAlign: 'center', paddingHorizontal: space.xl, paddingBottom: space.m },
});
