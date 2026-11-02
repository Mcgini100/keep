import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
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
import { radius, space, type, usePalette } from './src/theme';

type Tab = 'add' | 'queue' | 'library';

const TABS: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'add', label: 'Add', icon: 'add-circle-outline', active: 'add-circle' },
  { key: 'queue', label: 'Queue', icon: 'arrow-down-circle-outline', active: 'arrow-down-circle' },
  { key: 'library', label: 'Library', icon: 'albums-outline', active: 'albums' },
];

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const c = usePalette();
  const q = useQueue();
  const insets = useSafeAreaInsets();
  const waiting = (q.current ? 1 : 0) + q.pending.length;

  return (
    <View
      style={[
        styles.tabbar,
        { paddingBottom: Math.max(insets.bottom, space.s), backgroundColor: c.bg, borderTopColor: c.hairline },
      ]}
    >
      {TABS.map((t) => {
        const active = t.key === tab;
        const color = active ? c.accent : c.tertiary;
        return (
          <Pressable
            key={t.key}
            style={styles.tab}
            onPress={() => {
              if (!active) q.tap();
              onChange(t.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.key === 'queue' && waiting ? `Queue, ${waiting} waiting` : t.label}
          >
            <View>
              <Ionicons name={active ? t.active : t.icon} size={26} color={color} />
              {t.key === 'queue' && waiting > 0 && (
                <View style={[styles.badge, { backgroundColor: c.accent, borderColor: c.bg }]}>
                  <Text style={styles.badgeText}>{waiting > 99 ? '99+' : waiting}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.tabLabel, { color }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A quiet pill that offers a link found on the clipboard. */
function ClipboardOffer({ onAccept }: { onAccept: (text: string) => void }) {
  const c = usePalette();
  const q = useQueue();
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
        <Text style={[type.callout, { color: c.accent, fontWeight: '600' }]}>Use</Text>
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
  return (
    <SafeAreaProvider>
      <QueueProvider>
        <Shell />
      </QueueProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabbar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.s,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 0.1 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  offer: {
    position: 'absolute',
    left: space.l,
    right: space.l,
    bottom: 96,
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
