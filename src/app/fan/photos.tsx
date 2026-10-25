import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { View } from 'react-native';

import { Badge, Body, Button, Caption, Card, Empty, H1, H3, Row, Screen, Section, money, showMessage } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { useAuth, useTable } from '@/data';
import { useFanData } from '@/data/fan';
import { formatDay } from '@/lib/time';

export default function Photos() {
  const { backend, profile } = useAuth();
  const d = useFanData();
  const eventId = d.event?.id ?? '__none__';
  const products = useTable('photo_products', { eq: { eventId, active: true } });
  const orders = useTable('photo_orders', { eq: { userId: profile?.id ?? '' }, order: { column: 'createdAt', ascending: false } });
  const [cart, setCart] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const player = d.myPlayers[0];

  const items = products.data.filter((p) => cart[p.id]).map((p) => ({ productId: p.id, quantity: cart[p.id], unitPriceCents: p.priceCents }));
  const total = items.reduce((s, i) => s + i.quantity * i.unitPriceCents, 0);
  const qty = (id: string, delta: number) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(10, (c[id] ?? 0) + delta)) }));

  async function checkout() {
    if (!profile) return;
    setBusy(true);
    try {
      const [order] = await backend.insert('photo_orders', [
        { userId: profile.id, playerId: player?.id ?? null, items, totalCents: total, status: 'pending', createdAt: new Date().toISOString() },
      ]);
      const url = await backend.startCheckout(order.id);
      if (url) await WebBrowser.openBrowserAsync(url);
      else showMessage('Order placed', `Thanks! ${money(total)} — your photos will be ready after the session.`);
      setCart({});
    } catch (e) {
      showMessage('Checkout failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen refreshing={products.loading} onRefresh={() => (products.refresh(), orders.refresh())}>
      <H1>Photos</H1>
      <Body style={{ color: C.muted }}>
        Order prints from this week’s team and player photo sessions{player ? ` for ${player.firstName}` : ''}. Book your team’s photo session under Meetings.
      </Body>
      {products.data.length === 0 && <Empty icon="camera-outline" title="Photo packages coming soon" />}
      {products.data.map((p) => (
        <Card key={p.id}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <H3>{p.name}</H3>
              <Caption>{p.description}</Caption>
            </View>
            <H3 style={{ color: C.red }}>{money(p.priceCents)}</H3>
          </Row>
          <Row style={{ justifyContent: 'space-between' }}>
            {p.kind === 'bundle' ? <Badge label="Best value" tone="gold" icon="star" /> : <View />}
            <Row>
              <Button title="−" variant="secondary" small onPress={() => qty(p.id, -1)} disabled={!cart[p.id]} />
              <H3 style={{ minWidth: 24, textAlign: 'center' }}>{cart[p.id] ?? 0}</H3>
              <Button title="+" variant="secondary" small onPress={() => qty(p.id, 1)} />
            </Row>
          </Row>
        </Card>
      ))}
      {total > 0 && (
        <Card style={{ backgroundColor: C.navy, borderColor: C.navy }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <H3 style={{ color: C.white }}>Total</H3>
            <H3 style={{ color: C.white }}>{money(total)}</H3>
          </Row>
          <Button title="Checkout" icon="card" loading={busy} onPress={checkout} />
          <Caption style={{ color: '#C9D4E5' }}>Prints are shipped to the address on your registration.</Caption>
        </Card>
      )}
      {orders.data.length > 0 && (
        <Section title="My orders">
          {orders.data.map((o) => (
            <Card key={o.id} style={{ gap: S.xs }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <H3>{money(o.totalCents)}</H3>
                <Badge label={o.status} tone={o.status === 'paid' || o.status === 'fulfilled' ? 'green' : 'muted'} />
              </Row>
              <Caption>
                {formatDay(o.createdAt)} ·{' '}
                {o.items.map((i) => `${i.quantity}× ${products.data.find((p) => p.id === i.productId)?.name ?? 'Item'}`).join(', ')}
              </Caption>
            </Card>
          ))}
        </Section>
      )}
    </Screen>
  );
}
