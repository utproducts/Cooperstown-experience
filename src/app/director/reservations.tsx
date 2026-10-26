import { useState } from 'react';

import { Badge, Body, Button, Caption, Card, Empty, H1, Row, Screen, Segmented } from '@/components/ui';
import { useBackend, useTable } from '@/data';
import type { Reservation } from '@/data/types';
import { usePlaces } from '@/data/venue';
import { formatDay, relativeTime, to12h } from '@/lib/time';

const TONE: Record<Reservation['status'], 'gold' | 'green' | 'warn' | 'muted' | 'navy'> = { requested: 'gold', confirmed: 'green', declined: 'warn', cancelled: 'muted', seated: 'navy' };

/** Staff: table requests for each restaurant. Confirm or decline; the family sees it in the app. */
export default function ReservationsAdmin() {
  const backend = useBackend();
  const restaurants = usePlaces('restaurant');
  const [placeId, setPlaceId] = useState<string | null>(null);
  const place = placeId ?? restaurants.data[0]?.id ?? '__none__';
  const list = useTable('reservations', { eq: { placeId: place } });
  const [show, setShow] = useState<'open' | 'all'>('open');
  const rows = list.data
    .filter((r) => show === 'all' || r.status === 'requested' || r.status === 'confirmed')
    .sort((a, b) => `${a.onDate}${a.atTime}`.localeCompare(`${b.onDate}${b.atTime}`));
  const pending = list.data.filter((r) => r.status === 'requested').length;

  return (
    <Screen refreshing={list.loading} onRefresh={list.refresh}>
      <H1>Reservations</H1>
      {restaurants.data.length > 1 && <Segmented value={place} onChange={setPlaceId} options={restaurants.data.map((r) => ({ value: r.id, label: r.name }))} />}
      <Segmented
        value={show}
        onChange={setShow}
        options={[
          { value: 'open', label: `Upcoming (${pending} to confirm)` },
          { value: 'all', label: 'All' },
        ]}
      />
      {rows.length === 0 && (
        <Card>
          <Empty icon="calendar-outline" title="No table requests" />
        </Card>
      )}
      {rows.map((r) => (
        <Card key={r.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Body style={{ fontWeight: '800' }}>
              {formatDay(r.onDate)} · {to12h(r.atTime)} · {r.partySize} people
            </Body>
            <Badge label={r.status} tone={TONE[r.status]} />
          </Row>
          <Body>
            {r.name}
            {r.phone ? ` · ${r.phone}` : ''}
          </Body>
          {r.notes ? <Caption>Note: {r.notes}</Caption> : null}
          <Caption>
            #{r.id} · requested {relativeTime(r.createdAt)}
          </Caption>
          <Row style={{ flexWrap: 'wrap' }}>
            {r.status === 'requested' && <Button title="Confirm" small variant="dark" onPress={() => backend.update('reservations', r.id, { status: 'confirmed' })} />}
            {r.status === 'requested' && <Button title="Decline" small variant="secondary" onPress={() => backend.update('reservations', r.id, { status: 'declined' })} />}
            {r.status === 'confirmed' && <Button title="Seated" small variant="secondary" onPress={() => backend.update('reservations', r.id, { status: 'seated' })} />}
            {r.status === 'confirmed' && <Button title="Cancel" small variant="ghost" onPress={() => backend.update('reservations', r.id, { status: 'cancelled' })} />}
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
