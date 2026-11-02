import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import type { Platform } from '../lib/links';
import { radius, space, type, usePalette } from '../theme';

/* -------------------------------------------------------------------------- */
/* Press feedback — a gentle give, like a physical key                         */
/* -------------------------------------------------------------------------- */

export function Tactile({
  style,
  children,
  scaleTo = 0.97,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  return (
    <Pressable onPressIn={() => to(scaleTo)} onPressOut={() => to(1)} {...rest}>
      <Animated.View style={[style, { transform: [{ scale }] }, rest.disabled && { opacity: 0.4 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Buttons                                                                     */
/* -------------------------------------------------------------------------- */

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const c = usePalette();
  return (
    <Tactile
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.primary, { backgroundColor: c.accent }]}
    >
      {loading ? (
        <ActivityIndicator color={c.accentText} />
      ) : (
        <Text style={[type.headline, { color: c.accentText }]}>{label}</Text>
      )}
    </Tactile>
  );
}

export function TextButton({
  label,
  onPress,
  tone = 'accent',
  style,
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: 'accent' | 'danger' | 'secondary';
  style?: StyleProp<TextStyle>;
  disabled?: boolean;
}) {
  const c = usePalette();
  const color = tone === 'danger' ? c.danger : tone === 'secondary' ? c.secondary : c.accent;
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" disabled={disabled}>
      {({ pressed }) => (
        <Text
          style={[type.callout, { color, fontWeight: '500', opacity: disabled ? 0.35 : pressed ? 0.5 : 1 }, style]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  label,
  tone = 'secondary',
  size = 22,
}: {
  name: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
  tone?: 'secondary' | 'accent' | 'danger' | 'text';
  size?: number;
}) {
  const c = usePalette();
  const color = { secondary: c.secondary, accent: c.accent, danger: c.danger, text: c.text }[tone];
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel={label}>
      {({ pressed }) => <Ionicons name={name} size={size} color={color} style={{ opacity: pressed ? 0.4 : 1 }} />}
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Segmented control                                                           */
/* -------------------------------------------------------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = usePalette();
  return (
    <View style={[styles.segmented, { backgroundColor: c.surface }]} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              styles.segment,
              active && [styles.segmentActive, { backgroundColor: c.surfaceRaised }],
            ]}
          >
            <Text
              style={[
                type.caption,
                { color: active ? c.text : c.secondary, fontWeight: active ? '600' : '500' },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                    */
/* -------------------------------------------------------------------------- */

export function ProgressBar({ value, height = 4 }: { value: number; height?: number }) {
  const c = usePalette();
  const anim = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: 450, useNativeDriver: false }).start();
  }, [value, anim]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'], extrapolate: 'clamp' });
  return (
    <View
      style={{ height, borderRadius: height, backgroundColor: c.track, overflow: 'hidden' }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    >
      <Animated.View style={{ height, width, borderRadius: height, backgroundColor: c.accent }} />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Media                                                                       */
/* -------------------------------------------------------------------------- */

export function PlatformMark({ platform, size = 14 }: { platform: Platform | null; size?: number }) {
  const c = usePalette();
  const name = platform === 'youtube' ? 'logo-youtube' : platform === 'instagram' ? 'logo-instagram' : 'link';
  return <Ionicons name={name} size={size} color={c.secondary} />;
}

export function Thumb({
  uri,
  platform,
  width = 64,
  audio,
}: {
  uri?: string | null;
  platform: Platform | null;
  width?: number;
  audio?: boolean;
}) {
  const c = usePalette();
  const height = Math.round((width * 9) / 16) + 4;
  return (
    <View style={[styles.thumb, { width, height, backgroundColor: c.surface }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
      ) : (
        <PlatformMark platform={platform} size={18} />
      )}
      {audio && (
        <View style={styles.badge}>
          <Ionicons name="musical-note" size={10} color="#fff" />
        </View>
      )}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                      */
/* -------------------------------------------------------------------------- */

export function SectionLabel({ children, right }: { children: string; right?: React.ReactNode }) {
  const c = usePalette();
  return (
    <View style={styles.sectionLabel}>
      <Text style={[type.micro, { color: c.secondary, textTransform: 'uppercase' }]}>{children}</Text>
      {right}
    </View>
  );
}

export function Hairline({ inset = 0 }: { inset?: number }) {
  const c = usePalette();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.hairline, marginLeft: inset }} />;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = usePalette();
  return <View style={[styles.card, { backgroundColor: c.surface }, style]}>{children}</View>;
}

export function Row({
  label,
  detail,
  children,
  onPress,
}: {
  label: string;
  detail?: string;
  children?: React.ReactNode;
  onPress?: () => void;
}) {
  const c = usePalette();
  const content = (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: space.m }}>
        <Text style={[type.body, { color: c.text }]}>{label}</Text>
        {detail ? <Text style={[type.caption, { color: c.secondary, marginTop: 2 }]}>{detail}</Text> : null}
      </View>
      {children}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

export function ToggleRow({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const c = usePalette();
  return (
    <Row label={label} detail={detail}>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.accent, false: c.track }} />
    </Row>
  );
}

export function Empty({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  const c = usePalette();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={36} color={c.tertiary} />
      <Text style={[type.headline, { color: c.text, marginTop: space.l }]}>{title}</Text>
      <Text style={[type.callout, { color: c.secondary, marginTop: space.xs, textAlign: 'center' }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: 52,
    borderRadius: radius.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.s,
    padding: 2,
  },
  segment: {
    flex: 1,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.s - 2,
  },
  segmentActive: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  thumb: {
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.s,
    marginTop: space.xl,
  },
  card: {
    borderRadius: radius.m,
    overflow: 'hidden',
  },
  row: {
    minHeight: 52,
    paddingHorizontal: space.l,
    paddingVertical: space.m,
    flexDirection: 'row',
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: space.xxxl * 1.5,
    paddingHorizontal: space.xxl,
  },
});
