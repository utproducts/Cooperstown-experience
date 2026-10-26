import { imageSource } from '@/components/venue-image';
import type { ParkRules } from '@/lib/venue';

import { useTable } from './index';
import type { PlaceKind } from './types';

/** One of the venue's settings (site map, photos, park rules), or null until staff set it. */
export function useVenueSetting<T>(key: 'site_map' | 'photos' | 'park_rules') {
  const rows = useTable('venue_settings', { eq: { id: key } });
  return { ...rows, value: (rows.data[0]?.value ?? null) as T | null };
}

export function usePlaces(kind?: PlaceKind) {
  return useTable('places', { ...(kind ? { eq: { kind } } : {}), order: { column: 'sort' } });
}

/** A park photo for a header (staff upload them; the demo has sample art). Picks one by `index`. */
export function useParkPhoto(index = 0) {
  const { value } = useVenueSetting<{ hero?: string[] }>('photos');
  const list = value?.hero ?? [];
  return list.length ? imageSource(list[index % list.length]) : null;
}

export function useParkRules() {
  return useVenueSetting<ParkRules>('park_rules');
}
