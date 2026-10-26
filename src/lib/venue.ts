import type { Place, PlaceKind } from '../data/types';

export interface KindInfo {
  label: string;
  plural: string;
  icon: string;
  color: string;
}

/** How each kind of place looks on the map and in lists. */
export const PLACE_KINDS: Record<PlaceKind, KindInfo> = {
  field: { label: 'Field', plural: 'Fields', icon: 'baseball', color: '#2E7D32' },
  parking: { label: 'Parking', plural: 'Parking', icon: 'car', color: '#1F5FBF' },
  checkin: { label: 'Check-in', plural: 'Check-in', icon: 'qr-code', color: '#C8102E' },
  bunkhouse: { label: 'Bunkhouse', plural: 'Bunkhouses', icon: 'bed', color: '#8B5E3C' },
  trolley: { label: 'Trolley stop', plural: 'Trolley stops', icon: 'bus', color: '#C9A227' },
  food: { label: 'Concessions', plural: 'Concessions', icon: 'fast-food', color: '#E07A1F' },
  restaurant: { label: 'Restaurant', plural: 'Restaurants', icon: 'restaurant', color: '#0E2340' },
  vendor: { label: 'Vendor', plural: 'Vendors', icon: 'storefront', color: '#7B3FA0' },
  restroom: { label: 'Restrooms', plural: 'Restrooms', icon: 'man', color: '#5B6B7F' },
  first_aid: { label: 'First aid', plural: 'First aid', icon: 'medkit', color: '#C8102E' },
  info: { label: 'Info', plural: 'Info', icon: 'information-circle', color: '#0E7490' },
  attraction: { label: 'Thing to do', plural: 'Things to do', icon: 'sparkles', color: '#B45309' },
  lodging: { label: 'Lodging', plural: 'Lodging nearby', icon: 'home', color: '#4D7C0F' },
  other: { label: 'Place', plural: 'Other', icon: 'location', color: '#5B6B7F' },
};

/** Kinds that sit on the site map (the rest are around town, with an address instead of a pin). */
export const ON_MAP: PlaceKind[] = ['field', 'parking', 'checkin', 'bunkhouse', 'trolley', 'food', 'restaurant', 'vendor', 'restroom', 'first_aid', 'info', 'other'];

export const onMap = (p: Pick<Place, 'x' | 'y'>) => p.x !== null && p.y !== null;

/** Groups by category, keeping first-seen order. */
export function byCategory<T extends { category: string; sort: number }>(items: T[]): { category: string; items: T[] }[] {
  const out: { category: string; items: T[] }[] = [];
  for (const it of [...items].sort((a, b) => a.sort - b.sort)) {
    const key = it.category || 'Other';
    let g = out.find((x) => x.category === key);
    if (!g) out.push((g = { category: key, items: [] }));
    g.items.push(it);
  }
  return out;
}

/** Google Maps directions to a place off the map (lodging, things to do). */
export const directionsUrl = (p: Pick<Place, 'name' | 'address'>) => `https://maps.google.com/?q=${encodeURIComponent([p.name, p.address].filter(Boolean).join(', '))}`;

export interface Ceremony {
  date: string;
  /** "19:00" ET */
  time: string;
  placeId: string | null;
  headline: string;
  schedule: { time: string; title: string }[];
  expect: string[];
}

export function weekCeremony(settings: unknown): Ceremony | null {
  const c = (settings as { ceremony?: Partial<Ceremony> } | null)?.ceremony;
  if (!c?.date || !c.time) return null;
  return { date: c.date, time: c.time, placeId: c.placeId ?? null, headline: c.headline ?? '', schedule: c.schedule ?? [], expect: c.expect ?? [] };
}

export interface ParkRules {
  allowed: string[];
  notAllowed: string[];
  notes: string;
  sample?: boolean;
}

/** A leaderboard: best first (lowest time or highest number), ties share a place. */
export function rankResults<T extends { value: number }>(results: T[], better: 'high' | 'low'): (T & { place: number })[] {
  const sorted = [...results].sort((a, b) => (better === 'low' ? a.value - b.value : b.value - a.value));
  return sorted.map((r, i) => ({ ...r, place: i > 0 && sorted[i - 1].value === r.value ? 0 : i + 1 })).map((r, i, a) => ({ ...r, place: r.place || a[i - 1].place }));
}
