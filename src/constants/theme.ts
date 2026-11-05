import { Platform } from 'react-native';

/**
 * Unrivaled Sports, baseball palette (live.standards.site/unrivaledsports/color): Unrivaled Navy and Red first, with
 * Light Blue and Baseball Blue as accents, on white with White Smoke boxes. Red is for fills and graphics; small red
 * text uses Dark Red so it stays readable.
 */
export const C = {
  navy: '#1D2468',
  navyDeep: '#11163F',
  navySoft: '#2B3389',
  red: '#FF0000',
  redDark: '#BB0101',
  redSoft: '#FFE8E8',
  blue: '#0062FF',
  sky: '#76D6FF',
  cream: '#FFFFFF',
  creamDeep: '#E6E7EE',
  // Accent on navy (eyebrows, chips): Baseball Blue, the baseball palette's accent.
  gold: '#76D6FF',
  goldSoft: '#E6F6FF',
  green: '#1E7B45',
  greenSoft: '#E2F3E8',
  ink: '#14183F',
  muted: '#5E6283',
  border: '#E3E4EC',
  card: '#F2F2F2',
  white: '#FFFFFF',
  warn: '#B54708',
  warnSoft: '#FEF0C7',
} as const;

// Headlines: Review Poster Heavy in the brand (licensed); Anton is the free stand-in, loaded in app/_layout.tsx.
export const Fonts = {
  display: Platform.select({ default: 'Anton_400Regular', web: 'Anton_400Regular, "Arial Narrow", Impact, sans-serif' }),
  body: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, monospace' }),
};

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const R = { sm: 4, md: 8, lg: 12, pill: 999 } as const;
export const MaxWidth = 960;
