import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ImageField } from '@/components/image-upload';
import { Sheet } from '@/components/sheet';
import { Body, Button, Caption, Card, Divider, ErrorNote, Field, H1, ListItem, Row, Screen, Segmented, confirmAction, money } from '@/components/ui';
import { useBackend, useTable } from '@/data';
import type { Product, ProductKind } from '@/data/types';
import { usePlaces } from '@/data/venue';
import { byCategory } from '@/lib/venue';

const TITLES: Record<ProductKind, string> = { apparel: 'Shop products', concession: 'Concessions menu', menu: 'Restaurant menus' };

/** Staff: apparel, concessions and restaurant menu items. ?kind=apparel|concession|menu */
export default function ProductsAdmin() {
  const params = useLocalSearchParams<{ kind?: ProductKind }>();
  const backend = useBackend();
  const [kind, setKind] = useState<ProductKind>(params.kind ?? 'apparel');
  const restaurants = usePlaces('restaurant');
  const [placeId, setPlaceId] = useState<string | null>(null);
  const place = kind === 'menu' ? (placeId ?? restaurants.data[0]?.id ?? null) : null;
  const products = useTable('products', { eq: { kind }, order: { column: 'sort' } });
  const shown = products.data.filter((p) => kind !== 'menu' || p.placeId === place);
  const [editing, setEditing] = useState<(Partial<Product> & { id?: string }) | null>(null);

  return (
    <Screen refreshing={products.loading} onRefresh={products.refresh}>
      <H1>{TITLES[kind]}</H1>
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'apparel', label: 'Shop' },
          { value: 'concession', label: 'Concessions' },
          { value: 'menu', label: 'Restaurant menus' },
        ]}
      />
      {kind === 'menu' &&
        (restaurants.data.length ? (
          <Segmented value={place ?? ''} onChange={setPlaceId} options={restaurants.data.map((r) => ({ value: r.id, label: r.name }))} />
        ) : (
          <Caption>Add the restaurants first under Site map & places.</Caption>
        ))}
      <Caption>
        {kind === 'apparel'
          ? 'Families order these and pay at pickup. Add sizes for anything that comes in sizes.'
          : kind === 'concession'
            ? 'Families order these to their field and pay on delivery.'
            : 'Shown on the restaurant’s page. Families don’t order these in the app.'}
      </Caption>
      {byCategory(shown).map((g) => (
        <Card key={g.category} style={{ gap: 0 }}>
          <Caption style={{ fontWeight: '800', letterSpacing: 1 }}>{g.category.toUpperCase()}</Caption>
          {g.items.map((p, i) => (
            <View key={p.id}>
              {i > 0 && <Divider />}
              <ListItem
                icon={p.active ? 'pricetag' : 'eye-off'}
                title={`${p.name} · ${money(p.priceCents)}`}
                subtitle={[p.sizes.length ? p.sizes.join(', ') : '', p.active ? '' : 'Hidden'].filter(Boolean).join(' · ') || undefined}
                onPress={() => setEditing(p)}
              />
            </View>
          ))}
        </Card>
      ))}
      <Button
        title="Add item"
        icon="add"
        disabled={kind === 'menu' && !place}
        onPress={() => setEditing({ kind, placeId: place, eventId: null, category: '', name: '', description: '', priceCents: 0, sizes: [], imageUrl: '', active: true, sort: shown.length })}
      />
      {editing && (
        <ProductEditor
          key={editing.id ?? 'new'}
          product={editing}
          onClose={() => setEditing(null)}
          onSave={async (p) => {
            if (editing.id) await backend.update('products', editing.id, p);
            else await backend.insert('products', [p]);
            setEditing(null);
          }}
          onDelete={
            editing.id
              ? async () => {
                  if (await confirmAction('Delete this item?', editing.name ?? '', 'Delete')) {
                    await backend.remove('products', [editing.id!]);
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

function ProductEditor({
  product,
  onSave,
  onDelete,
  onClose,
}: {
  product: Partial<Product> & { id?: string };
  onSave: (p: Partial<Product>) => Promise<void>;
  onDelete?: () => void;
  onClose: () => void;
}) {
  // Parents render this with a key per item, so initial state comes straight from props.
  const [name, setName] = useState(product.name ?? '');
  const [category, setCategory] = useState(product.category ?? '');
  const [description, setDescription] = useState(product.description ?? '');
  const [price, setPrice] = useState(product.priceCents ? (product.priceCents / 100).toFixed(2) : '');
  const [sizes, setSizes] = useState((product.sizes ?? []).join(', '));
  const [imageUrl, setImageUrl] = useState(product.imageUrl ?? '');
  const [active, setActive] = useState(product.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cents = Math.round(parseFloat(price.replace(/[^\d.]/g, '')) * 100);
  return (
    <Sheet visible title={product.id ? `Edit ${product.name}` : 'New item'} onClose={onClose}>
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Category" value={category} onChangeText={setCategory} placeholder={product.kind === 'apparel' ? 'Hats, Shirts, Pins' : 'Food, Drinks, Snacks'} />
      <Field label="Description" value={description} onChangeText={setDescription} multiline />
      <Field label="Price ($)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="12.00" />
      {product.kind === 'apparel' && <Field label="Sizes (comma separated, blank if none)" value={sizes} onChangeText={setSizes} placeholder="YS, YM, YL, AS, AM, AL" />}
      {product.kind !== 'menu' && <ImageField label="Picture" value={imageUrl} onChange={setImageUrl} />}
      <Row style={{ justifyContent: 'space-between' }}>
        <Body style={{ flex: 1 }}>{active ? 'On sale' : 'Hidden from families'}</Body>
        <Button title={active ? 'Hide' : 'Show'} small variant="secondary" onPress={() => setActive(!active)} />
      </Row>
      <ErrorNote message={error} />
      <Button
        title="Save"
        loading={busy}
        disabled={!name.trim() || !(cents > 0)}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            await onSave({
              kind: product.kind,
              placeId: product.placeId ?? null,
              eventId: product.eventId ?? null,
              name: name.trim(),
              category: category.trim(),
              description: description.trim(),
              priceCents: cents,
              sizes: sizes.split(',').map((s) => s.trim()).filter(Boolean),
              imageUrl,
              active,
              sort: product.sort ?? 0,
            });
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
