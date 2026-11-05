import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Polygon, Rect } from 'react-native-svg';

import { C, R, S } from '@/constants/theme';

const LOGO = require('../../assets/images/asv-logo.png');
const RATIO = 992 / 607;

/** The Cooperstown All Star Village logo, on a white badge so it reads on photos and navy alike. */
export function BrandLogo({ height = 64, badge = false }: { height?: number; badge?: boolean }) {
  const img = <Image source={LOGO} style={{ height, width: height * RATIO }} resizeMode="contain" accessibilityLabel="Cooperstown All Star Village" />;
  return badge ? <View style={styles.badge}>{img}</View> : img;
}

// Unrivaled Sports marks, from the brand site's logo downloads. Never recolored, stretched or outlined.
const MARK = { red: require('../../assets/images/unrivaled-mark-red.png'), white: require('../../assets/images/unrivaled-mark-white.png') };
const MARK_RATIO = 600 / 197;
const LOCKUP = { navy: require('../../assets/images/unrivaled-lockup-red-navy.png'), white: require('../../assets/images/unrivaled-lockup-red-white.png') };
const LOCKUP_RATIO = 600 / 357;

/** The Unrivaled Sports pennant. White on navy or photos, red on white. At least 20 px tall on screen. */
export function UnrivaledMark({ height = 20, color = 'white' }: { height?: number; color?: 'red' | 'white' }) {
  return <Image source={MARK[color]} style={{ height, width: height * MARK_RATIO }} resizeMode="contain" accessibilityLabel="Unrivaled Sports" />;
}

/** "An Unrivaled Sports experience" with the primary lockup (red pennant; navy or white type). */
export function UnrivaledEndorsement({ on = 'light' }: { on?: 'light' | 'dark' }) {
  return (
    <View style={styles.endorse}>
      <Text style={[styles.endorseText, { color: on === 'dark' ? 'rgba(255,255,255,0.75)' : C.muted }]}>AN EXPERIENCE FROM</Text>
      <Image source={LOCKUP[on === 'dark' ? 'white' : 'navy']} style={{ height: 52, width: 52 * LOCKUP_RATIO }} resizeMode="contain" accessibilityLabel="Unrivaled Sports" />
    </View>
  );
}

/**
 * Speed lines: horizontal stripes that taper in along a diagonal, the brand's sense of movement (the strategy
 * cover). Fills its box; put it behind content.
 */
export function SpeedLines({ color = C.sky, opacity = 0.18, style }: { color?: string; opacity?: number; style?: StyleProp<ViewStyle> }) {
  const lines = 26;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        {Array.from({ length: lines }, (_, i) => {
          const y = (i / lines) * 100;
          const start = 100 - (i / lines) * 70 - 22;
          return <Rect key={i} x={start} y={y} width={100 - start} height={(100 / lines) * 0.42} fill={color} opacity={opacity} />;
        })}
      </Svg>
    </View>
  );
}

/** A red 45° slash across a corner, like the brand's spliced titles and Game Day art. */
export function Slash({ corner = 'topRight', size = 120, color = C.red }: { corner?: 'topRight' | 'bottomLeft'; size?: number; color?: string }) {
  const pos = corner === 'topRight' ? { top: 0, right: 0 } : { bottom: 0, left: 0, transform: [{ rotate: '180deg' }] };
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, pos]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Polygon points="38,0 70,0 100,30 100,62" fill={color} />
        <Polygon points="78,0 88,0 100,12 100,22" fill={C.sky} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', backgroundColor: C.white, borderRadius: R.md, paddingHorizontal: S.md, paddingVertical: S.sm },
  endorse: { alignItems: 'center', gap: S.sm, paddingVertical: S.lg },
  endorseText: { fontSize: 11, fontWeight: '800', letterSpacing: 2 },
});
