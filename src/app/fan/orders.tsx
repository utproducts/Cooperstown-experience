import { useEffect, useState } from 'react';

import { Badge, Body, Caption, Card, Empty, H1, Row, Screen, money } from '@/components/ui';
import { useBackend } from '@/data';
import { loadReceipts, type Receipt } from '@/lib/local-receipts';
import { formatDay, relativeTime, to12h } from '@/lib/time';

type Status = { status: string; detail: string };

const ORDER_LABEL: Record<string, { label: string; tone: 'navy' | 'green' | 'gold' | 'warn' | 'muted' }> = {
  new: { label: 'Received', tone: 'navy' },
  preparing: { label: 'Being made', tone: 'gold' },
  ready: { label: 'Ready for pickup', tone: 'green' },
  out: { label: 'On the way', tone: 'gold' },
  delivered: { label: 'Delivered', tone: 'green' },
  picked_up: { label: 'Picked up', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'warn' },
  requested: { label: 'Waiting to confirm', tone: 'gold' },
  confirmed: { label: 'Confirmed', tone: 'green' },
  declined: { label: 'Not available', tone: 'warn' },
  seated: { label: 'Seated', tone: 'green' },
};

/** Orders and table requests made on this phone, with their live status. */
export default function MyOrders() {
  const backend = useBackend();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [status, setStatus] = useState<Record<string, Status | { error: string }>>({});

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const list = await loadReceipts();
      if (!alive) return;
      setReceipts(list);
      const next: Record<string, Status | { error: string }> = {};
      await Promise.all(
        list.map(async (r) => {
          try {
            if (r.kind === 'reservation') {
              const s = await backend.reservationStatus(r.id, r.code);
              next[`${r.kind}-${r.id}`] = { status: s.status, detail: `${s.restaurant} · ${formatDay(s.onDate)} ${to12h(s.atTime)} · party of ${s.partySize}` };
            } else {
              const s = await backend.orderStatus(r.id, r.code);
              next[`${r.kind}-${r.id}`] = {
                status: s.status,
                detail: `${s.items.map((i) => `${i.qty}× ${i.name}${i.size ? ` (${i.size})` : ''}`).join(', ')} · ${money(s.totalCents)}${s.deliveryField ? ` · ${s.deliveryField}, ${s.deliverySpot}` : ''}`,
              };
            }
          } catch (e) {
            next[`${r.kind}-${r.id}`] = { error: (e as Error).message };
          }
        }),
      );
      if (alive) setStatus(next);
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [backend]);

  return (
    <Screen>
      <H1>My orders & reservations</H1>
      {receipts.length === 0 && (
        <Card>
          <Empty icon="receipt-outline" title="Nothing yet" body="Food, shop orders and table requests you make on this phone show up here." />
        </Card>
      )}
      {receipts.map((r) => {
        const s = status[`${r.kind}-${r.id}`];
        const l = s && 'status' in s ? ORDER_LABEL[s.status] : null;
        return (
          <Card key={`${r.kind}-${r.id}`}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Body style={{ fontWeight: '800', flex: 1 }}>{r.label}</Body>
              {l ? <Badge label={l.label} tone={l.tone} /> : null}
            </Row>
            {s && 'detail' in s ? <Caption>{s.detail}</Caption> : null}
            {s && 'error' in s ? <Caption>{s.error}</Caption> : null}
            <Caption>
              {r.kind === 'reservation' ? 'Reservation' : 'Order'} #{r.id} · code {r.code} · {relativeTime(r.at)}
            </Caption>
          </Card>
        );
      })}
    </Screen>
  );
}
