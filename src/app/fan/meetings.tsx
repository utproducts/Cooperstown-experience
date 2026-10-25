import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Badge, Body, Button, Caption, Card, Empty, Field, H1, H3, Row, Screen, Section, confirmAction, showMessage } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { useAuth, useTable } from '@/data';
import { useFanData } from '@/data/fan';
import type { MeetingSlot } from '@/data/types';
import { formatDay, formatTime, localDateKey } from '@/lib/time';

export default function Meetings() {
  const { backend, profile } = useAuth();
  const d = useFanData();
  const eventId = d.event?.id ?? '__none__';
  const tz = d.event?.timezone;
  const slots = useTable('meeting_slots', { eq: { eventId }, order: { column: 'startsAt' } });
  const bookings = useTable('meeting_bookings');
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const mine = bookings.data.filter((b) => b.userId === profile?.id);
  const countFor = (slotId: string) => bookings.data.filter((b) => b.slotId === slotId).length;
  const days = useMemo(() => [...new Set(slots.data.map((s) => localDateKey(s.startsAt, tz)))], [slots.data, tz]);

  async function book(slot: MeetingSlot) {
    if (!profile) return;
    setBusy(true);
    try {
      await backend.insert('meeting_bookings', [
        {
          slotId: slot.id,
          userId: profile.id,
          playerId: d.myPlayers[0]?.id ?? null,
          name: profile.name,
          note: note.trim() || null,
          createdAt: new Date().toISOString(),
        },
      ]);
      setNoteFor(null);
      setNote('');
      showMessage('Booked!', `${slot.title} · ${formatDay(slot.startsAt, tz)} at ${formatTime(slot.startsAt, tz)}, ${slot.location}`);
    } catch (e) {
      showMessage('Could not book', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen refreshing={slots.loading} onRefresh={() => (slots.refresh(), bookings.refresh())}>
      <H1>Meetings & sessions</H1>
      <Body style={{ color: C.muted }}>Reserve a spot for orientation, team photos, coach meetings and director office hours.</Body>

      {mine.length > 0 && (
        <Section title="My bookings">
          {mine.map((b) => {
            const s = slots.data.find((x) => x.id === b.slotId);
            if (!s) return null;
            return (
              <Card key={b.id} style={{ borderColor: C.green }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <H3 style={{ flex: 1 }}>{s.title}</H3>
                  <Badge label="Booked" tone="green" icon="checkmark" />
                </Row>
                <Caption>
                  {formatDay(s.startsAt, tz)} · {formatTime(s.startsAt, tz)} · {s.location}
                </Caption>
                <Button
                  title="Cancel booking"
                  variant="ghost"
                  small
                  onPress={async () => {
                    if (await confirmAction('Cancel booking?', s.title, 'Cancel booking')) await backend.remove('meeting_bookings', [b.id]);
                  }}
                />
              </Card>
            );
          })}
        </Section>
      )}

      {slots.data.length === 0 && <Empty icon="people-outline" title="No sessions posted yet" />}
      {days.map((day) => (
        <Section key={day} title={formatDay(day)}>
          {slots.data
            .filter((s) => localDateKey(s.startsAt, tz) === day)
            .map((s) => {
              const taken = countFor(s.id);
              const left = s.capacity - taken;
              const booked = mine.some((b) => b.slotId === s.id);
              return (
                <Card key={s.id}>
                  <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <H3>{s.title}</H3>
                      <Caption>
                        {formatTime(s.startsAt, tz)} · {s.durationMinutes} min · {s.location}
                      </Caption>
                    </View>
                    <Badge label={left > 0 ? (s.capacity === 1 ? 'Open' : `${left} spots left`) : 'Full'} tone={left > 0 ? 'navy' : 'muted'} />
                  </Row>
                  <Body>{s.description}</Body>
                  {noteFor === s.id ? (
                    <View style={{ gap: S.sm }}>
                      <Field placeholder="Optional note for the director" value={note} onChangeText={setNote} />
                      <Row>
                        <Button title="Confirm booking" loading={busy} onPress={() => book(s)} style={{ flex: 1 }} />
                        <Button title="Back" variant="secondary" onPress={() => setNoteFor(null)} />
                      </Row>
                    </View>
                  ) : (
                    <Button
                      title={booked ? 'Booked' : left > 0 ? 'Book' : 'Full'}
                      variant={booked ? 'secondary' : 'dark'}
                      small
                      disabled={booked || left <= 0}
                      onPress={() => setNoteFor(s.id)}
                    />
                  )}
                </Card>
              );
            })}
        </Section>
      ))}
    </Screen>
  );
}
