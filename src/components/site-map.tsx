import { useState, type ReactNode } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, type GestureResponderEvent, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';

import { C, R, S } from '@/constants/theme';
import type { Place } from '@/data/types';
import type { MapGeo } from '@/lib/geo';
import { onMap, PLACE_KINDS } from '@/lib/venue';

import { imageSource } from './venue-image';
import { Caption, Icon, type IconName } from './ui';

export interface SiteMapImage {
  url: string;
  width: number;
  height: number;
  /** Reference points that put GPS positions on the picture (staff: Site map & places → You’re here). */
  geo?: MapGeo;
}

interface CanvasProps {
  map: SiteMapImage;
  source: ImageSourcePropType;
  places: Place[];
  selectedId?: string | null;
  onSelect?: (p: Place) => void;
  onPlace?: (x: number, y: number) => void;
  /** Where the phone is, on the picture (0..1): shows "You're here", and a walking line to the selected place. */
  me?: { x: number; y: number } | null;
}

const ME = '#1A73E8';

/**
 * The venue's own site map with a pin for each place. At first the whole map fits (nothing cut off); zoom with the
 * buttons, tap a pin to select it, or open it full screen. When `onPlace` is set (staff placing a pin), tapping the
 * map reports where, as 0..1 of the picture.
 */
export function SiteMap({
  map,
  places,
  selectedId,
  onSelect,
  onPlace,
  me,
  height = 520,
}: {
  map: SiteMapImage | null;
  places: Place[];
  selectedId?: string | null;
  onSelect?: (p: Place) => void;
  onPlace?: (x: number, y: number) => void;
  me?: { x: number; y: number } | null;
  height?: number;
}) {
  const [full, setFull] = useState(false);
  const source = imageSource(map?.url);
  if (!map || !source) {
    return (
      <View style={[styles.empty, { height: 200 }]}>
        <Icon name="map-outline" size={40} color={C.muted} />
        <Caption style={{ textAlign: 'center' }}>The site map isn’t up yet. Staff add it under More → Park & venue → Site map.</Caption>
      </View>
    );
  }
  const canvas = { map, source, places, selectedId, onSelect, onPlace, me };
  return (
    <View style={{ gap: S.sm }}>
      <MapCanvas {...canvas} maxHeight={height} framed onFullScreen={() => setFull(true)} />
      {onPlace ? <Caption style={{ color: C.red, fontWeight: '700' }}>Tap the map where the pin goes.</Caption> : null}
      {full && <FullScreenMap {...canvas} onClose={() => setFull(false)} />}
    </View>
  );
}

function FullScreenMap({ onClose, ...canvas }: CanvasProps & { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const selected = canvas.places.find((p) => p.id === canvas.selectedId);
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={[styles.fullScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={{ flex: 1 }}>
          <MapCanvas
            {...canvas}
            onPlace={canvas.onPlace ? (x, y) => (canvas.onPlace!(x, y), onClose()) : undefined}
            onClose={onClose}
          />
        </View>
        {selected ? (
          <View style={styles.fullCaption}>
            <Text style={styles.fullCaptionText} numberOfLines={1}>
              {selected.name}
            </Text>
            {selected.description ? (
              <Text style={styles.fullCaptionSub} numberOfLines={2}>
                {selected.description}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/** Fills its box with the whole map (contain), centred; zoom scrolls it. */
function MapCanvas({
  map,
  source,
  places,
  selectedId,
  onSelect,
  onPlace,
  me,
  maxHeight,
  framed,
  onFullScreen,
  onClose,
}: CanvasProps & { maxHeight?: number; framed?: boolean; onFullScreen?: () => void; onClose?: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const ratio = map.height / map.width;
  // In a page the frame is as tall as the map at full width (capped); full screen it fills the screen.
  const frameHeight = framed ? Math.min(maxHeight ?? 520, box.width * ratio || maxHeight || 520) : undefined;
  const availHeight = framed ? (frameHeight ?? 0) : box.height;
  const fitWidth = Math.min(box.width, availHeight / ratio);
  const width = fitWidth * zoom;
  const imgHeight = width * ratio;
  const pinned = places.filter(onMap);
  const target = me ? pinned.find((p) => p.id === selectedId) : undefined;
  // Keep "You're here" clear of the selected place's label (which sits above its pin) and of the bottom edge.
  const meLabelAbove = !!me && (target ? target.y! > me.y : me.y > 0.9);
  const ready = box.width > 0 && availHeight > 0;

  const place = (e: GestureResponderEvent) => {
    if (!onPlace || !width) return;
    const { locationX, locationY } = e.nativeEvent;
    onPlace(Math.min(1, Math.max(0, locationX / width)), Math.min(1, Math.max(0, locationY / imgHeight)));
  };
  // Centre the picture while it's smaller than the box.
  const padX = Math.max(0, (box.width - width) / 2);
  const padY = Math.max(0, (availHeight - imgHeight) / 2);

  return (
    <View
      style={framed ? [styles.frame, { height: frameHeight }] : styles.fill}
      onLayout={(e) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
      {ready && (
        <ScrollView horizontal scrollEnabled={zoom > 1} showsHorizontalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingHorizontal: padX }}>
          <ScrollView scrollEnabled={zoom > 1} showsVerticalScrollIndicator={false} nestedScrollEnabled bounces={false} contentContainerStyle={{ paddingVertical: padY }}>
            {/* Only staff placing a pin tap the map itself; otherwise it's a plain picture so the pins stay tappable. */}
            <Surface onPress={onPlace ? place : undefined} style={{ width, height: imgHeight }}>
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
                    style={[styles.pin, { left: p.x! * width - size / 2, top: p.y! * imgHeight - size / 2, width: size, height: size, borderRadius: size / 2, backgroundColor: k.color }, on && styles.pinOn, target && !on && styles.pinFaded]}>
                    <Icon name={k.icon as IconName} size={on ? 20 : 14} color={C.white} />
                  </Pressable>
                );
              })}
              {me && target && (
                <Svg pointerEvents="none" width={width} height={imgHeight} style={StyleSheet.absoluteFill}>
                  <Line x1={me.x * width} y1={me.y * imgHeight} x2={target.x! * width} y2={target.y! * imgHeight} stroke={C.white} strokeWidth={9} strokeLinecap="round" />
                  <Line x1={me.x * width} y1={me.y * imgHeight} x2={target.x! * width} y2={target.y! * imgHeight} stroke={ME} strokeWidth={5} strokeDasharray="1 10" strokeLinecap="round" />
                </Svg>
              )}
              {me && (
                <View pointerEvents="none" style={[styles.me, { left: me.x * width - 22, top: me.y * imgHeight - 22 }]}>
                  <View style={styles.meDot} />
                </View>
              )}
              {me && (
                <View pointerEvents="none" style={[styles.meLabel, { left: Math.min(Math.max(me.x * width - 55, 4), width - 114), top: meLabelAbove ? me.y * imgHeight - 50 : me.y * imgHeight + 16 }]}>
                  <Text style={styles.meLabelText}>You’re here</Text>
                </View>
              )}
              {pinned
                .filter((p) => p.id === selectedId)
                .map((p) => (
                  <View key={`label-${p.id}`} pointerEvents="none" style={[styles.label, { left: Math.min(Math.max(p.x! * width - 90, 4), width - 184), top: Math.max(p.y! * imgHeight - 64, 4) }]}>
                    <Text style={styles.labelText} numberOfLines={1}>
                      {p.name}
                    </Text>
                  </View>
                ))}
            </Surface>
          </ScrollView>
        </ScrollView>
      )}
      <View style={styles.zoom}>
        {onClose && <MapButton icon="close" label="Close full screen map" onPress={onClose} />}
        {onFullScreen && <MapButton icon="expand" label="Full screen map" onPress={onFullScreen} />}
        <MapButton icon="add" label="Zoom in" onPress={() => setZoom((z) => Math.min(4, z + 0.5))} />
        <MapButton icon="remove" label="Zoom out" onPress={() => setZoom((z) => Math.max(1, z - 0.5))} />
      </View>
    </View>
  );
}

function MapButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} style={styles.zoomBtn} onPress={onPress}>
      <Icon name={icon} size={20} color={C.navy} />
    </Pressable>
  );
}

function Surface({ onPress, style, children }: { onPress?: (e: GestureResponderEvent) => void; style: { width: number; height: number }; children: ReactNode }) {
  return onPress ? (
    <Pressable onPress={onPress} style={style}>
      {children}
    </Pressable>
  ) : (
    <View style={style}>{children}</View>
  );
}

// The campus map's own navy, so the margins around it blend in.
const MAP_BG = '#0D2E59';

const styles = StyleSheet.create({
  frame: { borderRadius: R.lg, overflow: 'hidden', backgroundColor: MAP_BG, borderWidth: 1, borderColor: C.border },
  fill: { flex: 1, backgroundColor: MAP_BG },
  fullScreen: { flex: 1, backgroundColor: MAP_BG },
  fullCaption: { backgroundColor: C.white, paddingHorizontal: S.lg, paddingVertical: S.md, gap: 2 },
  fullCaptionText: { color: C.navy, fontWeight: '800', fontSize: 16 },
  fullCaptionSub: { color: C.muted, fontSize: 13 },
  empty: { borderRadius: R.lg, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center', gap: S.sm, padding: S.lg },
  pin: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.white, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3 },
  pinOn: { borderWidth: 3, zIndex: 2 },
  pinFaded: { opacity: 0.35 },
  label: { position: 'absolute', width: 180, backgroundColor: C.navy, borderRadius: R.sm, paddingVertical: 6, paddingHorizontal: 10, zIndex: 3 },
  labelText: { color: C.white, fontWeight: '700', fontSize: 13, textAlign: 'center' },
  me: { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(26,115,232,0.22)', alignItems: 'center', justifyContent: 'center', zIndex: 4 },
  meDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: ME, borderWidth: 3, borderColor: C.white },
  meLabel: { position: 'absolute', width: 110, backgroundColor: ME, borderRadius: R.pill, paddingVertical: 4, zIndex: 4 },
  meLabelText: { color: C.white, fontWeight: '800', fontSize: 12, textAlign: 'center' },
  zoom: { position: 'absolute', right: 10, top: 10, gap: 6 },
  zoomBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
});
