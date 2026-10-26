import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { PlaceCard } from '@/components/park-ui';
import { SiteMap, type SiteMapImage } from '@/components/site-map';
import { Body, Caption, Card, H1, ListItem, Screen, Segmented, type IconName } from '@/components/ui';
import type { PlaceKind } from '@/data/types';
import { usePlaces, useVenueSetting } from '@/data/venue';
import { onMap, PLACE_KINDS } from '@/lib/venue';

// Opening the map for one of these explains what you're looking at.
const INTRO: Partial<Record<PlaceKind, { title: string; body: string }>> = {
  parking: { title: 'Where to park', body: 'Pull in and follow the signs to the closest open lot. Tap a lot for directions on foot to check-in.' },
  checkin: { title: 'Where to check in', body: 'On arrival day, bring each player’s QR pass (Player tab) to the check-in tent. Uniforms and wristbands are handed out there.' },
  trolley: { title: 'Trolley stops', body: 'The trolley loops the park all day so nobody has to climb the big hills. Hop on at any stop.' },
  bunkhouse: { title: 'Bunkhouses', body: 'Your team’s bunkhouse is on the Player tab once staff assign it.' },
};

/** The interactive park map: filter by kind, tap a pin for details. ?kind=parking, ?place=<id> */
export default function ParkMap() {
  const params = useLocalSearchParams<{ kind?: PlaceKind; place?: string }>();
  const places = usePlaces();
  const { value: map } = useVenueSetting<SiteMapImage>('site_map');
  const [kind, setKind] = useState<PlaceKind | 'all'>(params.kind ?? 'all');
  const [selected, setSelected] = useState<string | null>(params.place ?? null);

  const pinned = places.data.filter((p) => p.active && onMap(p));
  const kinds = [...new Set(pinned.map((p) => p.kind))];
  const shown = pinned.filter((p) => kind === 'all' || p.kind === kind);
  const focus = places.data.find((p) => p.id === selected) ?? (shown.length === 1 ? shown[0] : null);
  const intro = kind !== 'all' ? INTRO[kind] : undefined;

  return (
    <Screen refreshing={places.loading} onRefresh={places.refresh}>
      <H1>{intro?.title ?? 'Park map'}</H1>
      {intro ? <Body style={{ color: '#4A5568' }}>{intro.body}</Body> : null}
      <Segmented
        value={kind}
        onChange={(k) => (setKind(k), setSelected(null))}
        options={[{ value: 'all' as const, label: 'Everything' }, ...kinds.map((k) => ({ value: k, label: PLACE_KINDS[k].plural }))]}
      />
      <SiteMap map={map} places={shown} selectedId={focus?.id ?? null} onSelect={(p) => setSelected(p.id)} />
      {focus ? <PlaceCard place={focus} /> : <Caption>Tap a pin to see what’s there.</Caption>}
      {kind !== 'all' && shown.length > 1 && (
        <Card style={{ gap: 0 }}>
          {shown
            .filter((p) => p.id !== focus?.id)
            .map((p) => (
              <ListItem key={p.id} icon={PLACE_KINDS[p.kind].icon as IconName} title={p.name} subtitle={p.hours || undefined} onPress={() => setSelected(p.id)} />
            ))}
        </Card>
      )}
    </Screen>
  );
}
