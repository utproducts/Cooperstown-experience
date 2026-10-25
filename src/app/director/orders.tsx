import { useState } from 'react';
import { View } from 'react-native';

import { Badge, Body, Button, Caption, Card, Field, H1, H2, H3, Row, Screen, Section, Segmented, Stat, money } from '@/components/ui';
import { C } from '@/constants/theme';
import { useBackend, useTable } from '@/data';
import { useDirectorData } from '@/data/director';
import type { PhotoProduct } from '@/data/types';
import { formatDateTime } from '@/lib/time';

export default function Orders() {
  const backend = useBackend();
  const d = useDirectorData();
  const eventId = d.event?.id ?? '__none__';
  const products = useTable('photo_products', { eq: { eventId } });
  const orders = useTable('photo_orders', { order: { column: 'createdAt', ascending: false } });
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [kind, setKind] = useState<PhotoProduct['kind']>('print');

  const productIds = new Set(products.data.map((p) => p.id));
  const eventOrders = orders.data.filter((o) => o.items.some((i) => productIds.has(i.productId)));
  const paid = eventOrders.filter((o) => o.status === 'paid' || o.status === 'fulfilled');
  const revenue = paid.reduce((s, o) => s + o.totalCents, 0);
  const playerName = (id: string | null) => {
    const p = d.players.find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName}` : 'No player';
  };

  return (
    <Screen refreshing={orders.loading} onRefresh={() => (orders.refresh(), products.refresh())}>
      <H1>Photos</H1>
      <Card>
        <Row>
          <Stat label="Paid orders" value={paid.length} />
          <Stat label="Revenue" value={money(revenue)} tone={C.green} />
          <Stat label="To fulfill" value={eventOrders.filter((o) => o.status === 'paid').length} tone={C.red} />
        </Row>
      </Card>

      <Section title="Packages">
        {products.data.map((p) => (
          <Card key={p.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <H3>{p.name}</H3>
                <Caption>{p.description}</Caption>
              </View>
              <H3>{money(p.priceCents)}</H3>
            </Row>
            <Row>
              <Badge label={p.kind} tone="muted" />
              <Button title={p.active ? 'Hide from families' : 'Show to families'} small variant="secondary" onPress={() => backend.update('photo_products', p.id, { active: !p.active })} />
            </Row>
          </Card>
        ))}
        <Card>
          <H2 style={{ fontSize: 18 }}>Add package</H2>
          <Field label="Name" value={name} onChangeText={setName} />
          <Field label="Description" value={description} onChangeText={setDescription} />
          <Field label="Price (USD)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: 'print', label: 'Print' },
              { value: 'bundle', label: 'Bundle' },
              { value: 'digital', label: 'Digital' },
            ]}
          />
          {kind === 'digital' && (
            <Caption style={{ color: C.warn }}>
              Note: Apple and Google require in-app purchase for digital goods bought inside the mobile apps. Physical prints can use card checkout.
            </Caption>
          )}
          <Button
            title="Add package"
            disabled={!name.trim() || !(Number(price) > 0) || !d.event}
            onPress={async () => {
              await backend.insert('photo_products', [
                { eventId, name: name.trim(), description: description.trim(), priceCents: Math.round(Number(price) * 100), kind, active: true },
              ]);
              setName('');
              setDescription('');
              setPrice('');
            }}
          />
        </Card>
      </Section>

      <Section title={`Orders (${eventOrders.length})`}>
        {eventOrders.length === 0 && <Body style={{ color: C.muted }}>No orders yet.</Body>}
        {eventOrders.map((o) => (
          <Card key={o.id}>
            <Row style={{ justifyContent: 'space-between' }}>
              <H3>
                {money(o.totalCents)} · {playerName(o.playerId)}
              </H3>
              <Badge label={o.status} tone={o.status === 'fulfilled' ? 'green' : o.status === 'paid' ? 'navy' : 'muted'} />
            </Row>
            <Caption>
              {formatDateTime(o.createdAt, d.event?.timezone)} · {o.items.map((i) => `${i.quantity}× ${products.data.find((p) => p.id === i.productId)?.name ?? 'Item'}`).join(', ')}
            </Caption>
            {o.status === 'paid' && <Button title="Mark fulfilled" small variant="dark" onPress={() => backend.update('photo_orders', o.id, { status: 'fulfilled' })} />}
          </Card>
        ))}
      </Section>
    </Screen>
  );
}
