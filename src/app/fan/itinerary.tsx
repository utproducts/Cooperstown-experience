import { useState } from 'react';
import { View } from 'react-native';

import { Badge, Body, Button, Caption, Card, H1, H3, Icon, Row, Screen, confirmAction, showMessage } from '@/components/ui';
import { ITINERARY } from '@/content/guide';
import { C, S } from '@/constants/theme';
import { useAuth, useTable } from '@/data';
import { useFanData } from '@/data/fan';
import type { MeetingSlot } from '@/data/types';
import { dateRange, formatDay, formatTime, localDateKey } from '@/lib/time';

/**
 * The week day by day: what happens each day, with the week's meetings and sessions (orientation, coach meetings,
 * team photos, office hours) on the day they happen, bookable right there.
 */
export default function Itinerary() {
  const { backend, profile } = useAuth();
  const d = useFanData();
  const event = d.event;
  const tz = event?.timezone;
  const slots = useTable('meeting_slots', { eq: { eventId: event?.id ?? '__none__' }, order: { column: 'startsAt' } });
  const bookings = useTable('meeting_bookings');
  const [busy, setBusy] = useState<string | null>(null);

  const meetings = backend.features.meetings ? slots.data : [];
  const mine = bookings.data.filter((b) => b.userId === profile?.id);
  const dates = event ? dateRange(event.startsOn, event.endsOn) : [];
  const today = localDateKey(new Date().toISOString(), tz);
  const dayCount = Math.max(dates.length, ...ITINERARY.map((i) => i.day + 1));

  async function book(slot: MeetingSlot) {
    if (!profile) return;
    const when = `${formatDay(slot.startsAt, tz)} at ${formatTime(slot.startsAt, tz)}`;
    if (!(await confirmAction(`Book ${slot.title}?`, `${when} · ${slot.location}`, 'Book'))) return;
    setBusy(slot.id);
    try {
      await backend.insert('meeting_bookings', [
        { slotId: slot.id, userId: profile.id, playerId: d.myPlayers[0]?.id ?? null, name: profile.name, note: null, createdAt: new Date().toISOString() },
      ]);
      showMessage('Booked!', `${slot.title} · ${when}, ${slot.location}`);
    } catch (e) {
      showMessage('Could not book', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen refreshing={slots.loading} onRefresh={() => (slots.refresh(), bookings.refresh())}>
      <H1>Itinerary</H1>
      <Body style={{ color: C.muted }}>Your week day by day, with meetings and sessions. Book a spot right here.</Body>
      {Array.from({ length: dayCount }, (_, day) => {
        const date = dates[day];
        const isToday = date === today;
        const plan = ITINERARY.filter((i) => i.day === day);
        const daySlots = date ? meetings.filter((s) => localDateKey(s.startsAt, tz) === date) : [];
        if (!plan.length && !daySlots.length) return null;
        return (
          <Card key={day} style={isToday ? { borderColor: C.red, borderWidth: 2 } : undefined}>
            <Row style={{ justifyContent: 'space-between' }}>
              <H3>
                Day {day + 1}
                {date ? ` · ${formatDay(date)}` : ''}
              </H3>
              {isToday && <Badge label="Today" tone="red" />}
            </Row>
            {plan.map((i) => (
              <Row key={i.title} gap={S.md} style={{ alignItems: 'flex-start' }}>
                <Icon name={i.icon} color={C.navy} />
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: '700' }}>
                    {i.time ? `${i.time} · ` : ''}
                    {i.title}
                  </Body>
                  <Caption>{i.detail}</Caption>
                </View>
              </Row>
            ))}
            {daySlots.length > 0 && <Caption style={{ fontWeight: '800', color: C.navy, marginTop: S.xs }}>MEETINGS & SESSIONS</Caption>}
            {daySlots.map((s) => {
              const left = s.capacity - s.bookedCount;
              const booking = mine.find((b) => b.slotId === s.id);
              return (
                <Row key={s.id} gap={S.md} style={{ alignItems: 'flex-start' }}>
                  <Icon name="people" color={booking ? C.green : C.navy} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Body style={{ fontWeight: '700' }}>
                      {formatTime(s.startsAt, tz)} · {s.title}
                    </Body>
                    <Caption>
                      {s.durationMinutes} min · {s.location}
                      {s.description ? ` · ${s.description}` : ''}
                    </Caption>
                    <Row style={{ flexWrap: 'wrap', marginTop: 2 }} gap={6}>
                      {booking ? (
                        <>
                          <Badge label="Booked" tone="green" icon="checkmark" />
                          <Button
                            title="Cancel"
                            small
                            variant="ghost"
                            onPress={async () => {
                              if (await confirmAction('Cancel booking?', s.title, 'Cancel booking')) await backend.remove('meeting_bookings', [booking.id]);
                            }}
                          />
                        </>
                      ) : (
                        <>
                          <Button title={left > 0 ? 'Book' : 'Full'} small variant="dark" disabled={left <= 0 || !profile} loading={busy === s.id} onPress={() => book(s)} />
                          <Caption>{left > 0 ? (s.capacity === 1 ? 'Open' : `${left} spots left`) : 'No spots left'}</Caption>
                        </>
                      )}
                    </Row>
                  </View>
                </Row>
              );
            })}
          </Card>
        );
      })}
      <Caption>Times are typical for the week and may change. The Game Schedule and Alerts are always current.</Caption>
    </Screen>
  );
}
