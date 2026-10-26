import type { ImageSourcePropType } from 'react-native';

// Pictures that ship with the app (the Village's map, logo and photos), referred to as "sample:<name>" in demo data.
const SAMPLE_IMAGES: Record<string, ImageSourcePropType> = {
  'asv-site-map': require('../../assets/images/asv-site-map.jpg'),
  'asv-entrance': require('../../assets/images/asv-entrance.jpg'),
  'asv-deck': require('../../assets/images/asv-deck.jpg'),
  'asv-country-inn': require('../../assets/images/asv-country-inn.jpg'),
  'asv-logo': require('../../assets/images/asv-logo.png'),
};

/** An uploaded picture's URL, or a picture that ships with the app ("sample:asv-site-map"). */
export function imageSource(url: string | null | undefined): ImageSourcePropType | null {
  if (!url) return null;
  if (url.startsWith('sample:')) return SAMPLE_IMAGES[url.slice(7)] ?? null;
  return { uri: url };
}
