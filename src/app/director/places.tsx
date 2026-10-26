import * as Location from 'expo-location';
import { useState } from 'react';
import { View } from 'react-native';

import { ImageField, useImageUpload } from '@/components/image-upload';
import { Sheet } from '@/components/sheet';
import { SiteMap, type SiteMapImage } from '@/components/site-map';
import { Badge, Button, Caption, Card, Divider, ErrorNote, Field, H1, H2, ListItem, Row, Screen, Segmented, confirmAction, type IconName } from '@/components/ui';
import { C } from '@/constants/theme';
import { useBackend } from '@/data';
import type { Place, PlaceKind } from '@/data/types';
import { usePlaces, useSiteMap } from '@/data/venue';
import { fitGeo, parseLatLng, type GeoPoint } from '@/lib/geo';
import { ON_MAP, onMap, PLACE_KINDS } from '@/lib/venue';

const ALL_KINDS = Object.keys(PLACE_KINDS) as PlaceKind[];
// `placing` holds this instead of a place id while staff put a reference point on the map.
const GEO = '__geo__';

const blank = (kind: PlaceKind): Omit<Place, 'id'> => ({
  kind,
  name: '',
  description: '',
  x: null,
  y: null,
  hours: '',
  website: '',
  phone: '',
  address: '',
  imageUrl: '',
  takesReservations: false,
  sort: 0,
  active: true,
});

/** Staff: the site map picture and every place on it (and around town), with pins placed by tapping the map. */
export default function PlacesAdmin() {
  const backend = useBackend();
  const places = usePlaces();
  const { value: map, refresh: refreshMap, uploaded } = useSiteMap();
  const up = useImageUpload();
  const [kind, setKind] = useState<PlaceKind>('parking');
  const [editing, setEditing] = useState<(Omit<Place, 'id'> & { id?: string }) | null>(null);
  const [placing, setPlacing] = useState<string | null>(null);
  const [geoDraft, setGeoDraft] = useState<{ label: string; lat: number; lng: number } | null>(null);
  const saveGeo = async (points: GeoPoint[]) => {
    const { url, width, height } = map;
    await backend.update('venue_settings', 'site_map', { id: 'site_map', value: { url, width, height, geo: { points } } satisfies SiteMapImage });
    refreshMap();
  };
  const list = places.data.filter((p) => p.kind === kind).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, undefined, { numeric: true }));

  return (
    <Screen refreshing={places.loading} onRefresh={places.refresh}>
      <H1>Site map & places</H1>
      <Card>
        <H2 style={{ fontSize: 18 }}>Site map picture</H2>
        <Caption>
          {uploaded ? 'Your uploaded site map.' : 'Showing the Village’s campus map that comes with the app.'} Upload a newer one any time (a clear, top-down picture works best), then place a pin for each spot below.
        </Caption>
        <Button
          title={uploaded ? 'Replace site map' : 'Upload a new site map'}
          icon="cloud-upload"
          small
          loading={up.busy}
          onPress={async () => {
            const r = await up.pick();
            if (!r) return;
            await backend.update('venue_settings', 'site_map', { id: 'site_map', value: { url: r.url, width: r.width, height: r.height } });
            refreshMap();
          }}
        />
        <ErrorNote message={up.error} />
        <SiteMap
          map={map}
          places={places.data}
          selectedId={placing}
          onPlace={
            placing
              ? async (x, y) => {
                  const r = (v: number) => Math.round(v * 1000) / 1000;
                  if (placing === GEO && geoDraft) {
                    // Real points replace the demo's rough ones.
                    const kept = map.geo?.sample ? [] : (map.geo?.points ?? []);
                    await saveGeo([...kept, { ...geoDraft, x: r(x), y: r(y) }]);
                    setGeoDraft(null);
                  } else if (placing !== GEO) {
                    await backend.update('places', placing, { x: r(x), y: r(y) });
                  }
                  setPlacing(null);
                }
              : undefined
          }
        />
        {placing && <Button title="Cancel placing" small variant="ghost" onPress={() => setPlacing(null)} />}
      </Card>

      <YoureHereSetup
        map={map}
        waiting={placing === GEO}
        onPlace={(draft) => {
          setGeoDraft(draft);
          setPlacing(GEO);
        }}
        onRemove={(i) => saveGeo((map.geo?.points ?? []).filter((_, j) => j !== i))}
      />

      <Segmented value={kind} onChange={setKind} options={ALL_KINDS.map((k) => ({ value: k, label: PLACE_KINDS[k].plural }))} />
      <Card style={{ gap: 0 }}>
        {list.length === 0 && <Caption>No {PLACE_KINDS[kind].plural.toLowerCase()} yet.</Caption>}
        {list.map((p, i) => (
          <View key={p.id}>
            {i > 0 && <Divider />}
            <ListItem
              icon={PLACE_KINDS[p.kind].icon as IconName}
              iconColor={PLACE_KINDS[p.kind].color}
              title={p.name + (p.active ? '' : ' (hidden)')}
              subtitle={[ON_MAP.includes(p.kind) ? (onMap(p) ? 'Pinned' : 'No pin yet') : p.address, p.hours].filter(Boolean).join(' · ')}
              onPress={() => setEditing(p)}
              right={
                ON_MAP.includes(p.kind) ? (
                  <Button title={onMap(p) ? 'Move pin' : 'Place pin'} small variant="secondary" disabled={!map} onPress={() => setPlacing(p.id)} />
                ) : undefined
              }
            />
          </View>
        ))}
      </Card>
      <Button title={`Add ${PLACE_KINDS[kind].label.toLowerCase()}`} icon="add" onPress={() => setEditing(blank(kind))} />

      {editing && (
        <PlaceEditor
          key={editing.id ?? 'new'}
          place={editing}
          onClose={() => setEditing(null)}
          onSave={async (p) => {
            if (editing.id) await backend.update('places', editing.id, p);
            else {
              const [created] = await backend.insert('places', [{ ...p, sort: list.length }]);
              if (ON_MAP.includes(p.kind) && map) setPlacing(created.id);
            }
            setEditing(null);
          }}
          onDelete={
            editing.id
              ? async () => {
                  if (await confirmAction('Delete this place?', editing.name, 'Delete')) {
                    await backend.remove('places', [editing.id!]);
                    setEditing(null);
                  }
                }
              : undefined
          }
        />
      )}
    </Screen>
  );
}

function PlaceEditor({
  place,
  onSave,
  onDelete,
  onClose,
}: {
  place: Omit<Place, 'id'> & { id?: string };
  onSave: (p: Omit<Place, 'id'>) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}) {
  // Parents render this with a key per place, so initial state comes straight from props.
  const [f, setF] = useState(place);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Place>(k: K) => (v: Place[K]) => setF((x) => ({ ...x, [k]: v }));
  const offMap = !ON_MAP.includes(f.kind);
  return (
    <Sheet visible title={place.id ? `Edit ${place.name}` : `New ${PLACE_KINDS[f.kind].label.toLowerCase()}`} onClose={onClose}>
      <Caption>Type</Caption>
      <Segmented value={f.kind} onChange={set('kind')} options={ALL_KINDS.map((k) => ({ value: k, label: PLACE_KINDS[k].label }))} />
      <Field label="Name" value={f.name} onChangeText={set('name')} />
      <Field label="Description" value={f.description} onChangeText={set('description')} multiline />
      <Field label="Hours" value={f.hours} onChangeText={set('hours')} placeholder="e.g. 7 AM–10 PM ET, or Every 15 min" />
      {offMap && <Field label="Address" value={f.address} onChangeText={set('address')} />}
      <Field label="Website" value={f.website} onChangeText={set('website')} autoCapitalize="none" keyboardType="url" />
      <Field label="Phone" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <ImageField label="Picture (optional)" value={f.imageUrl} onChange={set('imageUrl')} />
      {f.kind === 'restaurant' && (
        <Row style={{ justifyContent: 'space-between' }}>
          <Caption style={{ flex: 1 }}>Families can request a table in the app</Caption>
          <Button title={f.takesReservations ? 'Yes' : 'No'} small variant={f.takesReservations ? 'dark' : 'secondary'} onPress={() => set('takesReservations')(!f.takesReservations)} />
        </Row>
      )}
      <Row style={{ justifyContent: 'space-between' }}>
        <Caption style={{ flex: 1 }}>Show to families</Caption>
        <Button title={f.active ? 'Shown' : 'Hidden'} small variant={f.active ? 'dark' : 'secondary'} onPress={() => set('active')(!f.active)} />
      </Row>
      {!offMap && <Badge label={place.id ? (onMap(f) ? 'Pinned on the map' : 'No pin yet: use Place pin') : 'You’ll place the pin next'} tone="muted" />}
      <ErrorNote message={error} />
      <Button
        title="Save"
        loading={busy}
        disabled={!f.name.trim()}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            const { id: _id, ...rest } = f;
            await onSave({ ...rest, name: rest.name.trim() });
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {onDelete && <Button title="Delete" variant="danger" small onPress={onDelete} />}
    </Sheet>
  );
}

/**
 * Reference points that put a phone's GPS position on the drawn map ("You're here" and walking/driving directions
 * for families). Two make it work; three or more, spread across the map, make it line up well.
 */
function YoureHereSetup({
  map,
  waiting,
  onPlace,
  onRemove,
}: {
  map: SiteMapImage;
  waiting: boolean;
  onPlace: (draft: { label: string; lat: number; lng: number }) => void;
  onRemove: (index: number) => void;
}) {
  const [label, setLabel] = useState('');
  const [coords, setCoords] = useState('');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const points = map.geo?.points ?? [];
  const working = !!fitGeo(points, map.width, map.height);
  const parsed = parseLatLng(coords);
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <H2 style={{ fontSize: 18, flex: 1 }}>“You’re here” on the map</H2>
        <Badge label={map.geo?.sample ? 'Demo: approximate' : working ? 'On for families' : 'Not set up'} tone={map.geo?.sample ? 'warn' : working ? 'green' : 'muted'} />
      </Row>
      <Caption>
        The map is a drawing, so the app needs a few spots matched to their real location. Add at least 2, and 3 or more spread
        across the map (corners of the campus work best) so it lines up well. Then families see where they are and get
        walking and driving directions to every pin.
      </Caption>
      {points.map((p, i) => (
        <ListItem
          key={`${p.lat},${p.lng},${i}`}
          icon="locate"
          title={p.label || `Point ${i + 1}`}
          subtitle={`${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`}
          right={map.geo?.sample ? undefined : <Button title="Remove" small variant="ghost" onPress={() => onRemove(i)} />}
        />
      ))}
      <Divider />
      <Field label="Spot" value={label} onChangeText={setLabel} placeholder="e.g. Home plate, Field 1" />
      <Field
        label="Its coordinates"
        value={coords}
        onChangeText={setCoords}
        placeholder="42.46550, -75.10300"
        autoCapitalize="none"
        hint="Google Maps on a computer: right-click the spot and click the numbers to copy them. Or stand on the spot and tap Use my location."
      />
      <Row style={{ flexWrap: 'wrap' }}>
        <Button
          title="Use my location"
          icon="navigate"
          small
          variant="secondary"
          loading={locating}
          onPress={async () => {
            setError(null);
            setLocating(true);
            try {
              const perm = await Location.requestForegroundPermissionsAsync();
              if (!perm.granted) throw new Error('Allow location for this app first.');
              const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
              setCoords(`${l.coords.latitude.toFixed(6)}, ${l.coords.longitude.toFixed(6)}`);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setLocating(false);
            }
          }}
        />
        <Button
          title={waiting ? 'Now tap that spot on the map ↑' : 'Next: tap it on the map'}
          icon="pin"
          small
          disabled={!parsed || waiting}
          onPress={() => {
            onPlace({ label: label.trim(), ...parsed! });
            setLabel('');
            setCoords('');
          }}
        />
      </Row>
      {coords.trim() && !parsed ? <Caption style={{ color: C.warn }}>Use latitude, longitude, like 42.46550, -75.10300.</Caption> : null}
      <ErrorNote message={error} />
      <Caption>Uploading a new site map picture clears these, since the spots move.</Caption>
    </Card>
  );
}
