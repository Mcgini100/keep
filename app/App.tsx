import { Ionicons } from '@expo/vector-icons';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import * as Clipboard from 'expo-clipboard';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { extractLinks, linkKey } from './src/lib/links';
import { QueueProvider, useQueue } from './src/lib/store';
import { AddScreen } from './src/screens/AddScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { QueueScreen } from './src/screens/QueueScreen';
import { SettingsSheet } from './src/screens/SettingsSheet';
import { fonts, radius, space, type, usePalette } from './src/theme';

type Tab = 'add' | 'queue' | 'library';

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'add', label: 'Add', icon: 'add', active: 'add' },
  { key: 'queue', label: 'Queue', icon: 'arrow-down', active: 'arrow-down' },
  { key: 'library', label: 'Library', icon: 'albums-outline', active: 'albums' },
];

/** Dock height, shared with the clipboard offer that floats above it. */
const DOCK_HEIGHT = 64;

/** A floating ink dock. The current tab is an orange pill with its name. */
function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const c = usePalette();
  const q = useQueue();
  const insets = useSafeAreaInsets();
  const waiting = q.active.length + q.pending.length;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.dockWrap, { bottom: Math.max(insets.bottom, space.s) + space.s }]}
    >
      <View style={[styles.dock, { backgroundColor: c.dock }]} accessibilityRole="tablist">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              style={[styles.tab, active && { backgroundColor: c.accentFill, paddingHorizontal: space.l }]}
              onPress={() => {
                if (!active) q.tap();
                onChange(t.key);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.key === 'queue' && waiting ? `Queue, ${waiting} waiting` : t.label}
            >
              <Ionicons name={active ? t.active : t.icon} size={22} color={active ? c.accentText : c.dockText} />
              {active && <Text style={[styles.tabLabel, { color: c.accentText }]}>{t.label}</Text>}
              {t.key === 'queue' && waiting > 0 && !active && (
                <View style={[styles.badge, { backgroundColor: c.accentFill, borderColor: c.dock }]}>
                  <Text style={[styles.badgeText, { color: c.accentText }]}>{waiting > 99 ? '99+' : waiting}</Text>
                </View>
              )}
              {t.key === 'queue' && waiting > 0 && active && (
                <Text style={[styles.tabLabel, { color: c.accentText, opacity: 0.6 }]}>{waiting > 99 ? '99+' : waiting}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A quiet pill that offers a link found on the clipboard. */
function ClipboardOffer({ onAccept }: { onAccept: (text: string) => void }) {
  const c = usePalette();
  const q = useQueue();
  const insets = useSafeAreaInsets();
  const [offer, setOffer] = useState<{ text: string; count: number } | null>(null);
  const dismissed = useRef(new Set<string>());
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!q.hydrated || !q.settings.watchClipboard) return;
    const look = async () => {
      try {
        if (!(await Clipboard.hasStringAsync())) return;
        const text = await Clipboard.getStringAsync();
        const links = extractLinks(text).filter((l) => l.platform);
        if (!links.length) return;
        const key = links.map((l) => linkKey(l.url)).join(',');
        const known = new Set(q.items.map((i) => linkKey(i.url)));
        if (dismissed.current.has(key) || links.every((l) => known.has(linkKey(l.url)))) return;
        dismissed.current.add(key);
        setOffer({ text, count: links.length });
      } catch {
        // Clipboard access can be refused; that's fine.
      }
    };
    look();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && look());
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.hydrated, q.settings.watchClipboard]);

  useEffect(() => {
    Animated.spring(y, { toValue: offer ? 1 : 0, useNativeDriver: true, speed: 14, bounciness: 4 }).start();
  }, [offer, y]);

  if (!offer) return null;
  return (
    <Animated.View
      style={[
        styles.offer,
        {
          bottom: Math.max(insets.bottom, space.s) + space.s + DOCK_HEIGHT + space.m,
          backgroundColor: c.surfaceRaised,
          borderColor: c.hairline,
          opacity: y,
          transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
        },
      ]}
    >
      <Ionicons name="link" size={16} color={c.secondary} />
      <Text style={[type.callout, { color: c.text, flex: 1, marginLeft: space.s }]} numberOfLines={1}>
        {offer.count === 1 ? 'Link on clipboard' : `${offer.count} links on clipboard`}
      </Text>
      <Pressable
        hitSlop={8}
        onPress={() => {
          onAccept(offer.text);
          setOffer(null);
          q.tap();
        }}
      >
        <Text style={[styles.use, { color: c.accent }]}>USE</Text>
      </Pressable>
      <Pressable hitSlop={8} onPress={() => setOffer(null)} style={{ marginLeft: space.l }}>
        <Ionicons name="close" size={18} color={c.tertiary} />
      </Pressable>
    </Animated.View>
  );
}

function Shell() {
  const c = usePalette();
  const [tab, setTab] = useState<Tab>('add');
  const [settings, setSettings] = useState(false);
  const [draft, setDraft] = useState('');

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {tab === 'add' && (
          <AddScreen
            text={draft}
            setText={setDraft}
            onOpenSettings={() => setSettings(true)}
            onQueued={() => setTab('queue')}
          />
        )}
        {tab === 'queue' && <QueueScreen />}
        {tab === 'library' && <LibraryScreen />}
      </SafeAreaView>
      <ClipboardOffer
        onAccept={(text) => {
          setDraft((d) => (d ? `${d.trimEnd()}\n${text}` : text));
          setTab('add');
        }}
      />
      <TabBar tab={tab} onChange={setTab} />
      <SettingsSheet visible={settings} onClose={() => setSettings(false)} />
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });
  // Fonts ship inside the APK, so this is a frame or two. If they ever fail,
  // carry on with system type rather than blocking the app.
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: '#F3F0E8' }} />;
  return (
    <SafeAreaProvider>
      <QueueProvider>
        <Shell />
      </QueueProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  dockWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  dock: {
    height: DOCK_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    padding: 8,
    borderRadius: radius.pill,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  tab: {
    height: 48,
    minWidth: 56,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabLabel: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.monoBold, fontSize: 10 },
  use: { fontFamily: fonts.monoBold, fontSize: 12, letterSpacing: 1 },
  offer: {
    position: 'absolute',
    left: space.l,
    right: space.l,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    borderRadius: radius.m,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
