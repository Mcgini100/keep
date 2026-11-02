import React, { useRef } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { Engine, type Service } from '../../modules/keep-engine';
import { TextButton } from '../components/ui';
import { space, type, usePalette } from '../theme';

// Google refuses sign-in from pages that identify as an embedded WebView,
// so the YouTube sheet presents itself as mobile Chrome.
const MOBILE_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

const SERVICES: Record<Service, { title: string; url: string; userAgent?: string; note: string }> = {
  youtube: {
    title: 'YouTube',
    url: 'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fm.youtube.com%2F',
    userAgent: MOBILE_CHROME,
    note: "Sign in on Google's page. Keep only keeps the session, never your password.",
  },
  instagram: {
    title: 'Instagram',
    url: 'https://www.instagram.com/accounts/login/',
    note: "Sign in on Instagram's page. Keep only keeps the session, never your password.",
  },
};

/** Signs in on the service's own page and reuses only the session cookie. */
export function SignInSheet({
  service,
  onClose,
}: {
  service: Service | null;
  onClose: (signedIn: boolean) => void;
}) {
  const c = usePalette();
  const done = useRef(false);
  const cfg = service ? SERVICES[service] : null;

  const check = async () => {
    if (done.current || !service) return;
    const cookies = await Engine.sessionCookies(service);
    if (cookies) {
      done.current = true;
      onClose(true);
    }
  };

  return (
    <Modal
      visible={service != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onShow={() => {
        done.current = false;
      }}
      onRequestClose={() => onClose(false)}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
        <View style={styles.bar}>
          <Text style={[type.headline, { color: c.text }]}>{cfg?.title}</Text>
          <View style={styles.done}>
            <TextButton label="Close" onPress={() => onClose(false)} />
          </View>
        </View>
        <Text style={[type.caption, styles.note, { color: c.secondary }]}>{cfg?.note}</Text>
        {cfg && (
          <WebView
            source={{ uri: cfg.url }}
            userAgent={cfg.userAgent}
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
