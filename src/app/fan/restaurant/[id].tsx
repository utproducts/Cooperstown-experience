import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PlaceCard } from '@/components/park-ui';
import { TimeSelect } from '@/components/time-select';
import { imageSource } from '@/components/venue-image';
import { Badge, Body, Button, Caption, Card, ErrorNote, Field, Hero, Row, Screen, Segmented, money } from '@/components/ui';
import { C, Fonts, S } from '@/constants/theme';
import { useBackend, useTable } from '@/data';
import { useFanData } from '@/data/fan';
import { usePlaces, useParkPhoto } from '@/data/venue';
import { saveReceipt } from '@/lib/local-receipts';
import { DEFAULT_TZ, dateRange, formatDay, localDateKey, to12h, zoneLabel } from '@/lib/time';
import { byCategory } from '@/lib/venue';

/** One restaurant: its menu, and a table request the restaurant confirms. */
export default function Restaurant() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const backend = useBackend();
  const d = useFanData();
  const places = usePlaces('restaurant');
  const r = places.data.find((p) => p.id === id);
  const menu = useTable('products', { eq: { kind: 'menu', placeId: id } });
  const fallback = useParkPhoto(1);
  const tz = d.event?.timezone ?? DEFAULT_TZ;
  const today = localDateKey(new Date().toISOString(), tz);
  const days = (d.event ? dateRange(d.event.startsOn, d.event.endsOn) : [today]).filter((x) => x >= today);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState('18:00');
  const [party, setParty] = useState(4);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; code: string } | null>(null);
  const day = date ?? days[0] ?? today;

  if (!r) return <Screen>{places.loading ? null : <Body>That restaurant isn’t listed.</Body>}</Screen>;

  return (
    <Screen refreshing={menu.loading} onRefresh={menu.refresh}>
      <Hero image={imageSource(r.imageUrl) ?? fallback} eyebrow="Restaurant" title={r.name} subtitle={r.hours || undefined} />
      <PlaceCard place={{ ...r, imageUrl: '' }} />
      <Card>
        <Text style={styles.h}>Menu</Text>
        {menu.data.length === 0 && <Caption>The menu is coming soon.</Caption>}
        {byCategory(menu.data.filter((m) => m.active)).map((g) => (
          <View key={g.category} style={{ gap: 6 }}>
            <Text style={styles.cat}>{g.category}</Text>
            {g.items.map((m) => (
              <Row key={m.id} style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '700' }}>{m.name}</Body>
                  {m.description ? <Caption>{m.description}</Caption> : null}
                </View>
                <Body style={{ fontWeight: '800', color: C.navy }}>{money(m.priceCents)}</Body>
              </Row>
            ))}
          </View>
        ))}
      </Card>
      {r.takesReservations && (
        <Card>
          <Text style={styles.h}>Request a table</Text>
          {done ? (
            <View style={{ gap: 6 }}>
              <Badge label="Request sent" tone="green" icon="checkmark-circle" />
              <Body>
                {r.name} will confirm your table for {party} on {formatDay(day)} at {to12h(time)} {zoneLabel(tz)}.
              </Body>
              <Caption>
                Reservation #{done.id} · code {done.code}. Check its status any time under More → My orders & reservations.
              </Caption>
            </View>
          ) : (
            <>
              <Caption>Day</Caption>
              <Segmented value={day} onChange={setDate} options={days.map((x) => ({ value: x, label: x === today ? 'Today' : formatDay(x) }))} />
              <TimeSelect label="Time" value={time} onChange={setTime} step={15} min="11:00" max="22:00" timeZone={tz} />
              <Caption>Party size</Caption>
              <Row>
                <Button title="−" small variant="secondary" onPress={() => setParty((n) => Math.max(1, n - 1))} />
                <Body style={{ fontWeight: '800', minWidth: 40, textAlign: 'center' }}>{party}</Body>
                <Button title="+" small variant="secondary" onPress={() => setParty((n) => Math.min(40, n + 1))} />
              </Row>
              <Field label="Name" value={name} onChangeText={setName} />
              <Field label="Mobile (so they can text you)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <Field label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="High chair, birthday, team dinner…" />
              <ErrorNote message={error} />
              <Button
                title="Request table"
                icon="calendar"
                loading={busy}
                disabled={!name.trim()}
                onPress={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    const res = await backend.requestReservation({ placeId: r.id, onDate: day, atTime: time, partySize: party, name, phone, notes });
                    await saveReceipt({ kind: 'reservation', id: res.id, code: res.code, label: `${r.name} · ${formatDay(day)} ${to12h(time)}`, at: new Date().toISOString() });
                    setDone(res);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </>
          )}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  h: { fontFamily: Fonts.display, fontSize: 22, fontWeight: '700', color: C.navy },
  cat: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: C.red, textTransform: 'uppercase', marginTop: S.sm },
});
