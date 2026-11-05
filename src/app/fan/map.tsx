import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { openDirections } from '@/components/directions';
import { PlaceCard } from '@/components/park-ui';
import { SiteMap } from '@/components/site-map';
import { Body, Button, Caption, Card, H1, Icon, ListItem, Row, Screen, Segmented, type IconName } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { useBackend } from '@/data';
import { useMyLocation } from '@/data/location';
import type { PlaceKind } from '@/data/types';
import { placeLatLng, useMapGeo, usePlaces } from '@/data/venue';
import { distanceM, formatDistance, onPicture, walkMinutes, type GeoFit } from '@/lib/geo';
import { bestPath, type Pt } from '@/lib/walk';
import { onMap, PLACE_KINDS } from '@/lib/venue';

// Opening the map for one of these explains what you're looking at.
const INTRO: Partial<Record<PlaceKind, { title: string; body: string }>> = {
  parking: { title: 'Where to park', body: 'Pull in and follow the signs to the closest open lot. Tap a lot, then Drive for turn-by-turn directions.' },
  checkin: { title: 'Where to check in', body: 'On arrival day, bring each player’s QR pass (Player tab) to the check-in tent. Uniforms and wristbands are handed out there.' },
  trolley: { title: 'Trolley stops', body: 'The trolley loops the park all day so nobody has to climb the big hills. Hop on at any stop.' },
  bunkhouse: { title: 'Bunkhouses', body: 'Your team’s bunkhouse is on the Player tab once staff assign it.' },
};

/** Metres along a path on the picture, measured on the ground. */
const routeMetres = (pts: Pt[], fit: GeoFit) => pts.reduce((m, p, i) => (i ? m + distanceM(fit.toLatLng(pts[i - 1].x, pts[i - 1].y), fit.toLatLng(p.x, p.y)) : 0), 0);

/**
 * The interactive park map: share your location to see "You're here", then tap a pin or anywhere on the map for the
 * best walking path there, which follows you as you walk. Filter by kind. ?kind=parking, ?place=<id>
 */
export default function ParkMap() {
  const params = useLocalSearchParams<{ kind?: PlaceKind; place?: string }>();
  const backend = useBackend();
  const places = usePlaces();
  const { map, fit, walkGrid, sample } = useMapGeo();
  const loc = useMyLocation({ resumeIfAllowed: !!fit });
  const { height } = useWindowDimensions();
  const [kind, setKind] = useState<PlaceKind | 'all'>(params.kind ?? 'all');
  const [selected, setSelected] = useState<string | null>(params.place ?? null);
  const [dropped, setDropped] = useState<Pt | null>(null);

  const pinned = places.data.filter((p) => p.active && onMap(p));
  const kinds = [...new Set(pinned.map((p) => p.kind))];
  const shown = pinned.filter((p) => kind === 'all' || p.kind === kind);
  const focus = places.data.find((p) => p.id === selected) ?? (shown.length === 1 ? shown[0] : null);
  const intro = kind !== 'all' ? INTRO[kind] : undefined;

  // Where the phone is on the picture, if it's at the Village.
  const meXY = fit && loc.coords ? fit.toXY(loc.coords) : null;
  const here = meXY && onPicture(meXY) ? meXY : null;
  const away = loc.coords && fit && !here ? distanceM(loc.coords, fit.center) : null;
  // Where we're headed: a spot tapped on the map, else the selected pin.
  const destXY = dropped ?? (focus && onMap(focus) ? { x: focus.x!, y: focus.y! } : null);
  // Rounded so the path is only worked out again when the phone has really moved.
  const hereKey = here ? `${here.x.toFixed(3)},${here.y.toFixed(3)}` : '';
  const route = useMemo(
    () => (walkGrid && here && destXY ? bestPath(walkGrid, here, destXY) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walkGrid, hereKey, destXY?.x, destXY?.y],
  );
  const walk = fit && here && destXY ? (route ? routeMetres(route, fit) : distanceM(fit.toLatLng(here.x, here.y), fit.toLatLng(destXY.x, destXY.y))) : null;
  const arrived = walk !== null && walk < 15;
  const walkLine =
    walk === null ? null : (
      <Row gap={6}>
        <Icon name={arrived ? 'flag' : 'walk'} size={18} color={C.navy} />
        <Text style={styles.walk}>{arrived ? 'You’ve arrived' : `${route ? 'Best walking path' : 'About'}: ${walkMinutes(walk)} min · ${formatDistance(walk)}`}</Text>
      </Row>
    );
  // Somewhere sensible to pretend to stand in the demo: the information booth, else the middle of the map.
  const previewSpot = () => {
    const info = pinned.find((p) => p.kind === 'info') ?? pinned[0];
    return (info && fit && placeLatLng(info, fit)) || fit!.toLatLng(0.5, 0.5);
  };

  return (
    <Screen refreshing={places.loading} onRefresh={places.refresh}>
      <H1>{intro?.title ?? 'Park map'}</H1>
      {intro ? <Body style={{ color: '#4A5568' }}>{intro.body}</Body> : null}
      <Segmented
        value={kind}
        onChange={(k) => (setKind(k), setSelected(null), setDropped(null))}
        options={[{ value: 'all' as const, label: 'Everything' }, ...kinds.map((k) => ({ value: k, label: PLACE_KINDS[k].plural }))]}
      />

      {fit && (
        <LocationBar
          status={loc.status}
          here={!!here}
          simulated={loc.simulated}
          away={away}
          accuracy={loc.coords?.accuracy ?? null}
          onStart={loc.start}
          onStop={loc.stop}
          onDriveToVillage={() => openDirections(fit.center, 'driving')}
          onPreview={backend.mode === 'demo' || sample ? () => loc.simulate(previewSpot()) : undefined}
        />
      )}

      <SiteMap
        map={map}
        height={Math.max(320, height * 0.72)}
        places={shown}
        selectedId={dropped ? null : (focus?.id ?? null)}
        onSelect={(p) => (setSelected(p.id), setDropped(null))}
        onPlace={(x, y) => (setDropped({ x, y }), setSelected(null))}
        me={here}
        route={route}
        dest={dropped}
      />
      {dropped ? (
        <Card>
          <Row gap={S.md}>
            <Icon name="location" size={26} color={C.red} />
            <Body style={{ fontWeight: '800', flex: 1 }}>Your pin</Body>
            <Button title="Clear" small variant="ghost" onPress={() => setDropped(null)} />
          </Row>
          {walkLine ?? <Caption>{fit ? 'Share your location above to get the best walking path here.' : 'Tap a pin to see what’s there.'}</Caption>}
          {fit && (
            <Row style={{ flexWrap: 'wrap' }} gap={6}>
              <Button title="Walk" icon="walk" small variant="secondary" onPress={() => openDirections(fit.toLatLng(dropped.x, dropped.y), 'walking')} />
              <Button title="Drive" icon="car" small variant="secondary" onPress={() => openDirections(fit.toLatLng(dropped.x, dropped.y), 'driving')} />
            </Row>
          )}
        </Card>
      ) : focus ? (
        <PlaceCard place={focus} hideMapLink>
          {walkLine}
        </PlaceCard>
      ) : (
        <Caption>{here ? 'Tap a pin, or anywhere on the map, for the best walking path there.' : 'Tap a pin to see what’s there.'}</Caption>
      )}
      {kind !== 'all' && shown.length > 1 && (
        <Card style={{ gap: 0 }}>
          {shown
            .filter((p) => p.id !== focus?.id)
            .map((p) => {
              const ll = here && loc.coords ? placeLatLng(p, fit) : null;
              const d = ll && loc.coords ? distanceM(loc.coords, ll) : null;
              return (
                <ListItem
                  key={p.id}
                  icon={PLACE_KINDS[p.kind].icon as IconName}
                  title={p.name}
                  subtitle={[d !== null ? `${walkMinutes(d)} min walk` : '', p.hours].filter(Boolean).join(' · ') || undefined}
                  onPress={() => setSelected(p.id)}
                />
              );
            })}
        </Card>
      )}
    </Screen>
  );
}

function LocationBar({
  status,
  here,
  simulated,
  away,
  accuracy,
  onStart,
  onStop,
  onDriveToVillage,
  onPreview,
}: {
  status: ReturnType<typeof useMyLocation>['status'];
  here: boolean;
  simulated: boolean;
  away: number | null;
  accuracy: number | null;
  onStart: () => void;
  onStop: () => void;
  onDriveToVillage: () => void;
  onPreview?: () => void;
}) {
  if (status === 'off' || status === 'asking') {
    return (
      <Card style={styles.note}>
        <Row gap={S.md}>
          <View style={styles.promptIcon}>
            <Icon name="navigate" size={20} color={C.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Body style={{ fontWeight: '800' }}>Find your way around the Village</Body>
            <Caption>Share your location to see where you are, then tap anywhere you want to go for the best walking path.</Caption>
          </View>
        </Row>
        <Button title="Share my location" icon="locate" variant="dark" loading={status === 'asking'} onPress={onStart} />
        {onPreview && <Button title="Preview at the park" icon="eye" small variant="ghost" onPress={onPreview} />}
      </Card>
    );
  }
  if (status === 'denied' || status === 'error') {
    return (
      <Card style={styles.note}>
        <Body style={{ fontWeight: '700' }}>{status === 'denied' ? 'Location is off for this app' : 'We couldn’t find your location'}</Body>
        <Caption>
          {status === 'denied'
            ? 'To see “You’re here” on the map, allow location: iPhone Settings → Privacy & Security → Location Services → this app (or your browser) → While Using.'
            : 'Check that Location Services is on, then try again.'}
        </Caption>
        <Row style={{ flexWrap: 'wrap' }}>
          <Button title="Try again" icon="refresh" small variant="secondary" onPress={onStart} />
          {onPreview && <Button title="Preview at the park" icon="eye" small variant="secondary" onPress={onPreview} />}
        </Row>
      </Card>
    );
  }
  if (here) {
    return (
      <View style={styles.hereBar}>
        <View style={styles.hereDot} />
        <Text style={styles.hereText}>
          {simulated ? 'Preview: as if you’re standing at the park' : `You’re here${accuracy && accuracy > 40 ? ` (within about ${formatDistance(accuracy)})` : ''}`}
        </Text>
        <Button title={simulated ? 'Stop preview' : 'Hide'} small variant="secondary" onPress={onStop} />
      </View>
    );
  }
  return (
    <Card style={styles.note}>
      <Body style={{ fontWeight: '700' }}>{away !== null ? `You’re ${formatDistance(away)} from the Village` : 'Finding you…'}</Body>
      <Caption>“You’re here” shows on the map once you’re at the park.</Caption>
      <Row style={{ flexWrap: 'wrap' }}>
        <Button title="Drive to the Village" icon="car" small variant="dark" onPress={onDriveToVillage} />
        {onPreview && <Button title="Preview at the park" icon="eye" small variant="secondary" onPress={onPreview} />}
        <Button title="Hide" small variant="ghost" onPress={onStop} />
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  walk: { color: C.navy, fontWeight: '800', fontSize: 15 },
  note: { gap: S.sm },
  promptIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1A73E8', alignItems: 'center', justifyContent: 'center' },
  hereBar: { flexDirection: 'row', alignItems: 'center', gap: S.sm, backgroundColor: '#E8F0FE', borderRadius: R.lg, paddingVertical: S.sm, paddingHorizontal: S.md },
  hereDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#1A73E8', borderWidth: 2, borderColor: C.white },
  hereText: { flex: 1, color: '#174EA6', fontWeight: '800', fontSize: 14 },
});
