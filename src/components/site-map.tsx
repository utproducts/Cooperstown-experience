import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { C, R, S } from '@/constants/theme';
import type { Place } from '@/data/types';
import { onMap, PLACE_KINDS } from '@/lib/venue';

import { imageSource } from './venue-image';
import { Caption, Icon, type IconName } from './ui';

export interface SiteMapImage {
  url: string;
  width: number;
  height: number;
}

/**
 * The venue's own site map with a pin for each place. Pinch-free zoom (buttons), tap a pin to select it. When
 * `onPlace` is set (staff placing a pin), tapping the map reports where, as 0..1 of the picture.
 */
export function SiteMap({
  map,
  places,
  selectedId,
  onSelect,
  onPlace,
  height = 420,
}: {
  map: SiteMapImage | null;
  places: Place[];
  selectedId?: string | null;
  onSelect?: (p: Place) => void;
  onPlace?: (x: number, y: number) => void;
  height?: number;
}) {
  const [zoom, setZoom] = useState(1);
  const [boxWidth, setBoxWidth] = useState(0);
  const source = imageSource(map?.url);
  if (!map || !source) {
    return (
      <View style={[styles.empty, { height: 200 }]}>
        <Icon name="map-outline" size={40} color={C.muted} />
        <Caption style={{ textAlign: 'center' }}>The site map isn’t up yet. Staff add it under More → Park & venue → Site map.</Caption>
      </View>
    );
  }
  const width = boxWidth * zoom;
  const imgHeight = (width * map.height) / map.width;
  const pinned = places.filter(onMap);

  const place = (e: GestureResponderEvent) => {
    if (!onPlace || !width) return;
    const { locationX, locationY } = e.nativeEvent;
    onPlace(Math.min(1, Math.max(0, locationX / width)), Math.min(1, Math.max(0, locationY / imgHeight)));
  };

  return (
    <View style={{ gap: S.sm }}>
      <View style={[styles.frame, { height: Math.min(height, imgHeight || height) }]} onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}>
        {boxWidth > 0 && (
          <ScrollView horizontal={zoom > 1} scrollEnabled={zoom > 1} showsHorizontalScrollIndicator={false} bounces={false}>
            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled bounces={false}>
              <Pressable onPress={place} disabled={!onPlace} style={{ width, height: imgHeight }}>
                <Image source={source} style={{ width, height: imgHeight }} resizeMode="cover" />
                {pinned.map((p) => {
                  const k = PLACE_KINDS[p.kind];
                  const on = p.id === selectedId;
                  const size = on ? 36 : 26;
                  return (
                    <Pressable
                      key={p.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${p.name}, ${k.label}`}
                      onPress={() => onSelect?.(p)}
                      hitSlop={8}
                      style={[styles.pin, { left: p.x! * width - size / 2, top: p.y! * imgHeight - size / 2, width: size, height: size, borderRadius: size / 2, backgroundColor: k.color }, on && styles.pinOn]}>
                      <Icon name={k.icon as IconName} size={on ? 20 : 14} color={C.white} />
                    </Pressable>
                  );
                })}
                {pinned
                  .filter((p) => p.id === selectedId)
                  .map((p) => (
                    <View key={`label-${p.id}`} pointerEvents="none" style={[styles.label, { left: Math.min(Math.max(p.x! * width - 90, 4), width - 184), top: Math.max(p.y! * imgHeight - 64, 4) }]}>
                      <Text style={styles.labelText} numberOfLines={1}>
                        {p.name}
                      </Text>
                    </View>
                  ))}
              </Pressable>
            </ScrollView>
          </ScrollView>
        )}
        <View style={styles.zoom}>
          <Pressable accessibilityLabel="Zoom in" style={styles.zoomBtn} onPress={() => setZoom((z) => Math.min(3, z + 0.5))}>
            <Icon name="add" size={20} color={C.navy} />
          </Pressable>
          <Pressable accessibilityLabel="Zoom out" style={styles.zoomBtn} onPress={() => setZoom((z) => Math.max(1, z - 0.5))}>
            <Icon name="remove" size={20} color={C.navy} />
          </Pressable>
        </View>
      </View>
      {onPlace ? <Caption style={{ color: C.red, fontWeight: '700' }}>Tap the map where the pin goes.</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: R.lg, overflow: 'hidden', backgroundColor: '#A7C957', borderWidth: 1, borderColor: C.border },
  empty: { borderRadius: R.lg, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', gap: S.sm, padding: S.lg },
  pin: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.white, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  pinOn: { borderWidth: 3, zIndex: 2 },
  label: { position: 'absolute', width: 180, backgroundColor: C.navy, borderRadius: R.sm, paddingVertical: 6, paddingHorizontal: 10, zIndex: 3 },
  labelText: { color: C.white, fontWeight: '700', fontSize: 13, textAlign: 'center' },
  zoom: { position: 'absolute', right: 10, top: 10, gap: 6 },
  zoomBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
});
