import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { C, Fonts, R, S } from '@/constants/theme';
import type { Place } from '@/data/types';
import { directionsUrl, onMap, PLACE_KINDS } from '@/lib/venue';

import { imageSource } from './venue-image';
import { Body, Button, Caption, Card, Icon, Row, type IconName } from './ui';

export interface Tile {
  icon: IconName;
  title: string;
  subtitle?: string;
  color: string;
  href: string;
}

/** A grid of big, colorful tiles (the Park hub). */
export function TileGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <View style={styles.grid}>
      {tiles.map((t) => (
        <Pressable key={t.title} accessibilityRole="button" onPress={() => router.push(t.href as never)} style={({ pressed }) => [styles.tile, pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 }]}>
          <View style={[styles.tileIcon, { backgroundColor: t.color }]}>
            <Icon name={t.icon} size={22} color={C.white} />
          </View>
          <Text style={styles.tileTitle}>{t.title}</Text>
          {t.subtitle ? (
            <Text style={styles.tileSub} numberOfLines={2}>
              {t.subtitle}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

export function SectionTitle({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <View style={{ gap: 2, marginTop: S.sm }}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

/** A place with what families need: hours, where it is, and one-tap map, website, call or directions. */
export function PlaceCard({ place, children }: { place: Place; children?: React.ReactNode }) {
  const k = PLACE_KINDS[place.kind];
  const img = imageSource(place.imageUrl);
  return (
    <Card style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
      {img ? <Image source={img} style={styles.cardImage} resizeMode="cover" /> : null}
      <View style={{ padding: S.lg, gap: S.sm }}>
        <Row gap={S.md} style={{ alignItems: 'flex-start' }}>
          <View style={[styles.kindDot, { backgroundColor: k.color }]}>
            <Icon name={k.icon as IconName} size={18} color={C.white} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.placeName}>{place.name}</Text>
            <Caption>
              {k.label}
              {place.hours ? ` · ${place.hours}` : ''}
              {place.address ? ` · ${place.address}` : ''}
            </Caption>
          </View>
        </Row>
        {place.description ? <Body>{place.description}</Body> : null}
        {children}
        <Row style={{ flexWrap: 'wrap' }} gap={6}>
          {onMap(place) && <Button title="On the map" icon="map" small variant="secondary" onPress={() => router.push(`/fan/map?place=${place.id}` as never)} />}
          {!onMap(place) && (place.address || place.kind === 'attraction' || place.kind === 'lodging') && (
            <Button title="Directions" icon="navigate" small variant="secondary" onPress={() => Linking.openURL(directionsUrl(place))} />
          )}
          {place.website ? <Button title="Website" icon="globe" small variant="secondary" onPress={() => Linking.openURL(place.website)} /> : null}
          {place.phone ? <Button title="Call" icon="call" small variant="secondary" onPress={() => Linking.openURL(`tel:${place.phone.replace(/[^\d+]/g, '')}`)} /> : null}
        </Row>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    minHeight: 118,
    backgroundColor: C.white,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: S.md,
    gap: 6,
    shadowColor: '#0E2340',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  tileTitle: { fontSize: 16, fontWeight: '800', color: C.navy },
  tileSub: { fontSize: 12.5, color: C.muted, lineHeight: 17 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: C.red, textTransform: 'uppercase' },
  sectionTitle: { fontFamily: Fonts.display, fontSize: 22, fontWeight: '700', color: C.navy },
  cardImage: { width: '100%', height: 150 },
  kindDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  placeName: { fontSize: 17, fontWeight: '800', color: C.ink },
});
