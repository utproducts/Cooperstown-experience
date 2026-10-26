import { useState } from 'react';
import { View } from 'react-native';

import { ImageField, useImageUpload } from '@/components/image-upload';
import { Sheet } from '@/components/sheet';
import { SiteMap, type SiteMapImage } from '@/components/site-map';
import { Badge, Button, Caption, Card, Divider, ErrorNote, Field, H1, H2, ListItem, Row, Screen, Segmented, confirmAction, type IconName } from '@/components/ui';
import { useBackend } from '@/data';
import type { Place, PlaceKind } from '@/data/types';
import { usePlaces, useVenueSetting } from '@/data/venue';
import { ON_MAP, onMap, PLACE_KINDS } from '@/lib/venue';

const ALL_KINDS = Object.keys(PLACE_KINDS) as PlaceKind[];

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
  const { value: map, refresh: refreshMap } = useVenueSetting<SiteMapImage>('site_map');
  const up = useImageUpload();
  const [kind, setKind] = useState<PlaceKind>('parking');
  const [editing, setEditing] = useState<(Omit<Place, 'id'> & { id?: string }) | null>(null);
  const [placing, setPlacing] = useState<string | null>(null);
  const list = places.data.filter((p) => p.kind === kind).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, undefined, { numeric: true }));

  return (
    <Screen refreshing={places.loading} onRefresh={places.refresh}>
      <H1>Site map & places</H1>
      <Card>
        <H2 style={{ fontSize: 18 }}>Site map picture</H2>
        <Caption>Upload the park’s own site map (a clear, top-down picture works best). Then place a pin for each spot below.</Caption>
        <Button
          title={map ? 'Replace site map' : 'Upload site map'}
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
                  await backend.update('places', placing, { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
                  setPlacing(null);
                }
              : undefined
          }
        />
        {placing && <Button title="Cancel placing" small variant="ghost" onPress={() => setPlacing(null)} />}
      </Card>

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
