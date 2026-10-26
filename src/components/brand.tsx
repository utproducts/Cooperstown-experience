import { Image, StyleSheet, View } from 'react-native';

import { C, R, S } from '@/constants/theme';

const LOGO = require('../../assets/images/asv-logo.png');
const RATIO = 992 / 607;

/** The Cooperstown All Star Village logo, on a white badge so it reads on photos and navy alike. */
export function BrandLogo({ height = 64, badge = false }: { height?: number; badge?: boolean }) {
  const img = <Image source={LOGO} style={{ height, width: height * RATIO }} resizeMode="contain" accessibilityLabel="Cooperstown All Star Village" />;
  return badge ? <View style={styles.badge}>{img}</View> : img;
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', backgroundColor: C.white, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm },
});
