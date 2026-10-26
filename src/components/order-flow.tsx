import { router } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { C, Fonts, R, S } from '@/constants/theme';
import { useBackend } from '@/data';
import type { PlacedOrder } from '@/data/backend';
import type { Product } from '@/data/types';
import { saveReceipt } from '@/lib/local-receipts';
import { byCategory } from '@/lib/venue';

import { Sheet } from './sheet';
import { imageSource } from './venue-image';
import { Badge, Body, Button, Caption, Card, ErrorNote, Field, Row, Segmented, money } from './ui';

type CartLine = { product: Product; size: string; qty: number };
const lineKey = (l: { product: Product; size: string }) => `${l.product.id}|${l.size}`;

/** Where you're sitting at the field. A seat sign's QR code (Staff → Seat QR codes) fills it in. */
export const DELIVERY_SPOTS = ['1st base side', '3rd base side', 'Behind home plate', 'Outfield'];

/**
 * Browse, add to cart and check out. Apparel is paid at pickup; concessions are paid on delivery to a field and
 * seat (prefilled from a seat sign's QR code). Prices are set by the database when the order is placed.
 */
export function OrderFlow({
  kind,
  products,
  eventId,
  fields = [],
  initialField = '',
  initialSpot = '',
}: {
  kind: 'apparel' | 'concession';
  products: Product[];
  eventId: string | null;
  fields?: string[];
  initialField?: string;
  initialSpot?: string;
}) {
  const backend = useBackend();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [checkout, setCheckout] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [field, setField] = useState(initialField);
  const [spot, setSpot] = useState(initialSpot || DELIVERY_SPOTS[0]);
  const [seat, setSeat] = useState('');
  const [notes, setNotes] = useState('');
  const where = [field, spot, seat.trim()].filter(Boolean).join(', ');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  const total = cart.reduce((s, l) => s + l.qty * l.product.priceCents, 0);
  const count = cart.reduce((s, l) => s + l.qty, 0);
  const add = (p: Product) => {
    const size = p.sizes.length ? (sizes[p.id] ?? '') : '';
    if (p.sizes.length && !size) return;
    setCart((c) => {
      const k = lineKey({ product: p, size });
      const found = c.find((l) => lineKey(l) === k);
      return found ? c.map((l) => (lineKey(l) === k ? { ...l, qty: Math.min(20, l.qty + 1) } : l)) : [...c, { product: p, size, qty: 1 }];
    });
  };
  const change = (k: string, d: number) => setCart((c) => c.map((l) => (lineKey(l) === k ? { ...l, qty: l.qty + d } : l)).filter((l) => l.qty > 0));

  if (placed) {
    return (
      <Card style={{ borderColor: C.green, borderWidth: 2 }}>
        <Badge label="Order placed" tone="green" icon="checkmark-circle" />
        <Text style={styles.big}>Order #{placed.id}</Text>
        <Body>
          {kind === 'concession'
            ? `We’re bringing it to your seat: ${where}. Pay ${money(placed.totalCents)} when it arrives.`
            : `Pick it up at the Info & Pro Shop and pay ${money(placed.totalCents)} there.`}
        </Body>
        <Caption>Pickup code: {placed.code}. Track it under More → My orders & reservations.</Caption>
        <Row>
          <Button title="Track my order" icon="time" small variant="dark" onPress={() => router.push('/fan/orders' as never)} />
          <Button title="Order more" small variant="secondary" onPress={() => (setPlaced(null), setCart([]))} />
        </Row>
      </Card>
    );
  }

  return (
    <View style={{ gap: S.md }}>
      {products.length === 0 && <Caption>Nothing’s on sale yet. Check back soon.</Caption>}
      {byCategory(products.filter((p) => p.active)).map((g) => (
        <View key={g.category} style={{ gap: S.sm }}>
          <Text style={styles.cat}>{g.category}</Text>
          {g.items.map((p) => {
            const img = imageSource(p.imageUrl);
            const inCart = cart.filter((l) => l.product.id === p.id).reduce((s, l) => s + l.qty, 0);
            return (
              <Card key={p.id} style={{ flexDirection: 'row', gap: S.md, alignItems: 'center' }}>
                {img ? <Image source={img} style={styles.thumb} /> : null}
                <View style={{ flex: 1, gap: 4 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text style={styles.name}>{p.name}</Text>
                    <Text style={styles.price}>{money(p.priceCents)}</Text>
                  </Row>
                  {p.description ? <Caption>{p.description}</Caption> : null}
                  {p.sizes.length > 0 && (
                    <Row style={{ flexWrap: 'wrap' }} gap={6}>
                      {p.sizes.map((s) => (
                        <Button key={s} title={s} small variant={sizes[p.id] === s ? 'dark' : 'secondary'} onPress={() => setSizes((x) => ({ ...x, [p.id]: s }))} />
                      ))}
                    </Row>
                  )}
                  <Row>
                    <Button
                      title={p.sizes.length && !sizes[p.id] ? 'Pick a size' : inCart ? `Add another (${inCart})` : 'Add'}
                      icon="add"
                      small
                      disabled={!!p.sizes.length && !sizes[p.id]}
                      onPress={() => add(p)}
                    />
                  </Row>
                </View>
              </Card>
            );
          })}
        </View>
      ))}
      {count > 0 && (
        <View style={styles.bar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.barTitle}>
              {count} item{count === 1 ? '' : 's'} · {money(total)}
            </Text>
            <Caption style={{ color: '#C9D4E5' }}>{kind === 'concession' ? 'Pay on delivery' : 'Pay at pickup'}</Caption>
          </View>
          <Button title="Checkout" icon="cart" onPress={() => setCheckout(true)} />
        </View>
      )}
      {checkout && (
        <Sheet visible title="Checkout" onClose={() => setCheckout(false)}>
          {cart.map((l) => (
            <Row key={lineKey(l)} style={{ justifyContent: 'space-between' }}>
              <Body style={{ flex: 1 }}>
                {l.product.name}
                {l.size ? ` · ${l.size}` : ''}
              </Body>
              <Row gap={6}>
                <Button title="−" small variant="secondary" onPress={() => change(lineKey(l), -1)} />
                <Body style={{ fontWeight: '800', minWidth: 22, textAlign: 'center' }}>{l.qty}</Body>
                <Button title="+" small variant="secondary" onPress={() => change(lineKey(l), 1)} />
              </Row>
            </Row>
          ))}
          <Row style={{ justifyContent: 'space-between' }}>
            <Body style={{ fontWeight: '800' }}>Total</Body>
            <Body style={{ fontWeight: '800' }}>{money(total)}</Body>
          </Row>
          {kind === 'concession' && (
            <>
              <Caption style={{ fontWeight: '800', color: C.navy }}>Delivered to your seat</Caption>
              <Caption>Which field?</Caption>
              {fields.length > 0 ? (
                <Segmented value={field} onChange={setField} options={fields.map((f) => ({ value: f, label: f }))} />
              ) : (
                <Field placeholder="Field, e.g. Field 3" value={field} onChangeText={setField} />
              )}
              <Caption>Where are you sitting?</Caption>
              <Segmented value={spot} onChange={setSpot} options={DELIVERY_SPOTS.map((s) => ({ value: s, label: s }))} />
              <Field label="How do we find you? (optional)" value={seat} onChangeText={setSeat} placeholder="Top row of the bleachers, blue umbrella…" />
            </>
          )}
          <Field label="Name for the order" value={name} onChangeText={setName} />
          <Field label="Mobile (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder={kind === 'concession' ? 'No onions, extra ketchup…' : ''} />
          <Caption>{kind === 'concession' ? 'A runner brings it to your seat. Pay when it arrives (cash or card).' : 'Pay when you pick it up at the Info & Pro Shop.'} Online payment is coming soon.</Caption>
          <ErrorNote message={error} />
          <Button
            title={`Place order · ${money(total)}`}
            icon="checkmark-circle"
            loading={busy}
            disabled={!name.trim() || (kind === 'concession' && !field.trim()) || count === 0}
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                const o = await backend.placeOrder({
                  kind,
                  eventId,
                  items: cart.map((l) => ({ productId: l.product.id, qty: l.qty, size: l.size })),
                  name,
                  phone,
                  field: kind === 'concession' ? field : '',
                  spot: kind === 'concession' ? [spot, seat.trim()].filter(Boolean).join(' · ') : '',
                  notes,
                });
                await saveReceipt({ kind, id: o.id, code: o.code, label: kind === 'concession' ? `Food to your seat, ${field}` : 'Shop order', at: new Date().toISOString() });
                setCheckout(false);
                setPlaced(o);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </Sheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cat: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: C.red, textTransform: 'uppercase' },
  thumb: { width: 72, height: 72, borderRadius: R.md, backgroundColor: C.cream },
  name: { flex: 1, fontSize: 16, fontWeight: '800', color: C.ink },
  price: { fontSize: 16, fontWeight: '800', color: C.navy },
  bar: { flexDirection: 'row', alignItems: 'center', gap: S.md, backgroundColor: C.navy, borderRadius: R.lg, padding: S.md },
  barTitle: { color: C.white, fontWeight: '800', fontSize: 16 },
  big: { fontFamily: Fonts.display, fontSize: 26, fontWeight: '700', color: C.navy },
});
