import { useState } from 'react';
import { View } from 'react-native';

import { Badge, Body, Button, Caption, Card, Empty, H1, Row, Screen, Segmented, money } from '@/components/ui';
import { C } from '@/constants/theme';
import { useBackend, useTable } from '@/data';
import type { ShopOrder, ShopOrderStatus } from '@/data/types';
import { formatTime, relativeTime } from '@/lib/time';

// What comes next for each kind of order.
const NEXT: Record<ShopOrder['kind'], Partial<Record<ShopOrderStatus, { to: ShopOrderStatus; label: string }>>> = {
  concession: { new: { to: 'preparing', label: 'Start making' }, preparing: { to: 'out', label: 'Out for delivery' }, out: { to: 'delivered', label: 'Delivered & paid' } },
  apparel: { new: { to: 'ready', label: 'Ready for pickup' }, ready: { to: 'picked_up', label: 'Picked up & paid' } },
};
const OPEN: ShopOrderStatus[] = ['new', 'preparing', 'ready', 'out'];

/** Staff: the live queue of concession deliveries and shop pickups. */
export default function ShopOrders() {
  const backend = useBackend();
  const [kind, setKind] = useState<ShopOrder['kind']>('concession');
  const [show, setShow] = useState<'open' | 'done'>('open');
  const orders = useTable('shop_orders', { eq: { kind } });
  const list = orders.data
    .filter((o) => (show === 'open' ? OPEN.includes(o.status) : !OPEN.includes(o.status)))
    .sort((a, b) => (show === 'open' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)));
  const waiting = orders.data.filter((o) => OPEN.includes(o.status)).length;

  return (
    <Screen refreshing={orders.loading} onRefresh={orders.refresh}>
      <H1>Orders</H1>
      <Segmented
        value={kind}
        onChange={setKind}
        options={[
          { value: 'concession', label: 'Concessions' },
          { value: 'apparel', label: 'Shop pickups' },
        ]}
      />
      <Segmented
        value={show}
        onChange={setShow}
        options={[
          { value: 'open', label: `Open (${waiting})` },
          { value: 'done', label: 'Done' },
        ]}
      />
      {list.length === 0 && (
        <Card>
          <Empty icon="receipt-outline" title={show === 'open' ? 'No open orders' : 'Nothing finished yet'} body={show === 'open' ? 'New orders show up here within seconds.' : undefined} />
        </Card>
      )}
      {list.map((o) => {
        const next = NEXT[o.kind][o.status];
        return (
          <Card key={o.id} style={{ borderLeftWidth: 4, borderLeftColor: o.status === 'new' ? C.red : C.gold }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ fontWeight: '800' }}>
                #{o.id} · {o.customerName}
              </Body>
              <Badge label={o.status.replace('_', ' ')} tone={o.status === 'new' ? 'red' : o.status === 'cancelled' ? 'warn' : 'navy'} />
            </Row>
            {o.kind === 'concession' && (
              <Body style={{ fontWeight: '800', color: C.navy }}>
                → {o.deliveryField} · {o.deliverySpot}
              </Body>
            )}
            <View>
              {o.items.map((l, i) => (
                <Body key={i}>
                  {l.qty}× {l.name}
                  {l.size ? ` (${l.size})` : ''}
                </Body>
              ))}
            </View>
            {o.notes ? <Caption>Note: {o.notes}</Caption> : null}
            <Caption>
              {money(o.totalCents)} · {o.payment === 'paid' ? 'paid' : o.kind === 'concession' ? 'collect on delivery' : 'collect at pickup'} · {formatTime(o.createdAt)} ({relativeTime(o.createdAt)})
              {o.customerPhone ? ` · ${o.customerPhone}` : ''} · code {o.pickupCode}
            </Caption>
            <Row style={{ flexWrap: 'wrap' }}>
              {next && <Button title={next.label} small variant="dark" onPress={() => backend.update('shop_orders', o.id, { status: next.to })} />}
              {OPEN.includes(o.status) && <Button title="Cancel" small variant="ghost" onPress={() => backend.update('shop_orders', o.id, { status: 'cancelled' })} />}
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}
