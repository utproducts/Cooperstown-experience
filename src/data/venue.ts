import { useMemo } from 'react';

import type { SiteMapImage } from '@/components/site-map';
import { imageSource } from '@/components/venue-image';
import { fitGeo, type LatLng } from '@/lib/geo';
import { onMap, type ParkRules } from '@/lib/venue';

import { useTable } from './index';
import type { Place, PlaceKind } from './types';

/** One of the venue's settings (site map, photos, park rules), or null until staff set it. */
export function useVenueSetting<T>(key: 'site_map' | 'photos' | 'park_rules') {
  const rows = useTable('venue_settings', { eq: { id: key } });
  return { ...rows, value: (rows.data[0]?.value ?? null) as T | null };
}

export function usePlaces(kind?: PlaceKind) {
  return useTable('places', { ...(kind ? { eq: { kind } } : {}), order: { column: 'sort' } });
}

// The Village's own campus map and photos ship with the app, so headers and the map look right before staff upload
// anything; what staff upload replaces them.
export const DEFAULT_PHOTOS = ['sample:asv-entrance', 'sample:asv-deck', 'sample:asv-country-inn'];
export const DEFAULT_SITE_MAP: SiteMapImage = { url: 'sample:asv-site-map', width: 2000, height: 2000 };

/** A park photo for a header. Picks one by `index`. */
export function useParkPhoto(index = 0) {
  const { value } = useVenueSetting<{ hero?: string[] }>('photos');
  const list = value?.hero?.length ? value.hero : DEFAULT_PHOTOS;
  return imageSource(list[index % list.length]);
}

/** The site map picture staff uploaded, or the Village's campus map. */
export function useSiteMap() {
  const s = useVenueSetting<SiteMapImage>('site_map');
  const value = s.value?.url ? s.value : DEFAULT_SITE_MAP;
  return { ...s, value, uploaded: !!s.value?.url && !s.value.url.startsWith('sample:') };
}

/** How GPS positions land on the site map, once staff have set reference points (null before). */
export function useMapGeo() {
  const { value: map } = useSiteMap();
  const fit = useMemo(() => fitGeo(map.geo?.points, map.width, map.height), [map]);
  return { map, fit, sample: !!map.geo?.sample };
}

/** Where a pinned place really is, worked out from the map. */
export function placeLatLng(place: Place, fit: ReturnType<typeof fitGeo>): LatLng | null {
  return fit && onMap(place) ? fit.toLatLng(place.x!, place.y!) : null;
}

export function useParkRules() {
  return useVenueSetting<ParkRules>('park_rules');
}
