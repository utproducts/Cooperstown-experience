import type { ImageSourcePropType } from 'react-native';

const SAMPLE_IMAGES: Record<string, ImageSourcePropType> = {
  'site-map': require('../../assets/images/sample-site-map.png'),
  'hero-dusk': require('../../assets/images/sample-hero-dusk.png'),
  'hero-ball': require('../../assets/images/sample-hero-ball.png'),
};

/** An uploaded picture's URL, or the demo's bundled sample art ("sample:site-map"). */
export function imageSource(url: string | null | undefined): ImageSourcePropType | null {
  if (!url) return null;
  if (url.startsWith('sample:')) return SAMPLE_IMAGES[url.slice(7)] ?? null;
  return { uri: url };
}
