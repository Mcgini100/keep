import { useColorScheme } from 'react-native';

/**
 * Design language — "Archive"
 * ---------------------------
 * Keep is a place for things worth keeping, so it borrows from print: warm
 * paper and ink, a serif display face for titles, monospaced figures for the
 * machinery (counts, percentages, speeds), and a single signal orange that
 * only ever marks what you can act on or what is moving.
 *
 * Structure comes from ruled lines rather than boxes. Motion only explains
 * what just happened.
 */

const light = {
  bg: '#F3F0E8', // paper
  surface: '#E9E5DA', // pressed paper: inputs, tracks
  surfaceRaised: '#FBFAF6',
  text: '#111110', // ink
  secondary: '#5E5B53', // 5.9:1 on paper
  tertiary: '#8A857A', // 3.2:1, hints and placeholders only
  hairline: 'rgba(17,17,16,0.14)',
  rule: '#111110', // the heavy rule that opens a section
  accent: '#C73600', // orange legible as text on paper (4.7:1)
  accentFill: '#FF5B1A', // signal orange for filled shapes
  accentText: '#111110', // ink on signal orange (6.1:1)
  dock: '#111110',
  dockText: '#F3F0E8',
  dockMuted: '#8A857A',
  success: '#1F7A3F',
  danger: '#B4232A',
  track: 'rgba(17,17,16,0.10)',
};

const dark: typeof light = {
  bg: '#0C0C0B',
  surface: '#181816',
  surfaceRaised: '#1F1F1C',
  text: '#F3F0E8',
  secondary: '#A39F94',
  tertiary: '#77736A',
  hairline: 'rgba(243,240,232,0.14)',
  rule: '#F3F0E8',
  accent: '#FF5B1A', // 6.3:1 on night
  accentFill: '#FF5B1A',
  accentText: '#111110',
  dock: '#F3F0E8',
  dockText: '#111110',
  dockMuted: '#77736A',
  success: '#4ADE80',
  danger: '#FF6B6B',
  track: 'rgba(243,240,232,0.12)',
};

export type Palette = typeof light;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Brand colours outside the light/dark palettes (icon, splash). */
export const brand = { orange: '#FF5B1A', ink: '#111110', paper: '#F3F0E8' } as const;

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { s: 6, m: 12, l: 18, pill: 999 } as const;

/** Room for the floating dock at the bottom of every scrolling screen. */
export const DOCK_CLEARANCE = 128;

export const fonts = {
  display: 'InstrumentSerif_400Regular',
  displayItalic: 'InstrumentSerif_400Regular_Italic',
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const type = {
  // Display: the serif, set large and tight like a magazine masthead.
  hero: { fontFamily: fonts.display, fontSize: 64, lineHeight: 64, letterSpacing: -2 },
  largeTitle: { fontFamily: fonts.display, fontSize: 52, lineHeight: 56, letterSpacing: -1.5 },
  title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  // Text: the system face, so long titles stay readable at any size setting.
  headline: { fontSize: 17, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 17, fontWeight: '400' as const, letterSpacing: -0.2 },
  callout: { fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.1 },
  caption: { fontSize: 13, fontWeight: '400' as const, letterSpacing: 0 },
  // Machinery: mono, for labels, counts and live figures.
  micro: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2 },
  mono: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.2 },
  figure: { fontFamily: fonts.monoBold, fontSize: 13, letterSpacing: 0 },
};
