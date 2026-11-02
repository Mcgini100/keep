import { useColorScheme } from 'react-native';

/**
 * Design language
 * ---------------
 * Restraint over ornament. One accent colour, generous space, system type,
 * hairline structure, and motion that only ever explains what just happened.
 */

const light = {
  bg: '#FFFFFF',
  surface: '#F5F5F7',
  surfaceRaised: '#FFFFFF',
  text: '#1D1D1F',
  secondary: '#6E6E73',
  tertiary: '#AEAEB2',
  hairline: 'rgba(0,0,0,0.08)',
  accent: '#0071E3',
  accentText: '#FFFFFF',
  success: '#248A3D',
  danger: '#D70015',
  track: 'rgba(0,0,0,0.06)',
};

const dark: typeof light = {
  bg: '#000000',
  surface: '#1C1C1E',
  surfaceRaised: '#2C2C2E',
  text: '#F5F5F7',
  secondary: '#98989D',
  tertiary: '#636366',
  hairline: 'rgba(255,255,255,0.10)',
  accent: '#2997FF',
  accentText: '#FFFFFF',
  success: '#30D158',
  danger: '#FF453A',
  track: 'rgba(255,255,255,0.10)',
};

export type Palette = typeof light;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { s: 10, m: 14, l: 22, pill: 999 } as const;

export const type = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.8 },
  title: { fontSize: 22, fontWeight: '600' as const, letterSpacing: -0.4 },
  headline: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 17, fontWeight: '400' as const, letterSpacing: -0.2 },
  callout: { fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.1 },
  caption: { fontSize: 13, fontWeight: '400' as const, letterSpacing: 0 },
  micro: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.4 },
};
