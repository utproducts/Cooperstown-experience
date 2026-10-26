import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { directionsUrl, type LatLng, type TravelMode } from '@/lib/geo';

// iPhones (the app, or Safari on the web) get Apple Maps; everyone else Google Maps.
const appleMaps = () => Platform.OS === 'ios' || (Platform.OS === 'web' && typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent));

/** Opens turn-by-turn directions to a spot (or an address) in the phone's maps app. */
export function openDirections(to: LatLng | string, mode: TravelMode) {
  if (typeof to !== 'string') return Linking.openURL(directionsUrl(to, mode, appleMaps()));
  const q = encodeURIComponent(to);
  return Linking.openURL(
    appleMaps() ? `https://maps.apple.com/?daddr=${q}&dirflg=${mode === 'walking' ? 'w' : 'd'}` : `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=${mode}`,
  );
}
