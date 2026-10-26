import { Platform } from 'react-native';

/** Classic ballpark palette: navy and stitch red on white, light grey boxes, with a field green accent. */
export const C = {
  navy: '#0E2340',
  navyDeep: '#081629',
  navySoft: '#1D3A63',
  red: '#C8102E',
  redSoft: '#FBE7EA',
  cream: '#FFFFFF',
  creamDeep: '#E9ECF0',
  gold: '#C9A227',
  goldSoft: '#FBF3D9',
  green: '#2F6B3A',
  greenSoft: '#E3F1E5',
  ink: '#1B1F2A',
  muted: '#667085',
  border: '#E3E6EA',
  card: '#F3F4F6',
  white: '#FFFFFF',
  warn: '#B54708',
  warnSoft: '#FEF0C7',
} as const;

export const Fonts = {
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' }),
  body: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'ui-monospace, Menlo, monospace' }),
};

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const R = { sm: 8, md: 12, lg: 18, pill: 999 } as const;
export const MaxWidth = 960;
