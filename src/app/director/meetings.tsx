import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Badge, Body, Button, Caption, Card, ErrorNote, Field, H1, H2, H3, Row, Screen, Section, Segmented, confirmAction } from '@/components/ui';
import { S } from '@/constants/theme';
import { useBackend, useTable } from '@/data';
import { useDirectorData } from '@/data/director';
import { dateRange, formatDay, formatTime, localDateKey, zonedToIso } from '@/lib/time';

export default function DirectorMeetings() {
  const backend = useBackend();
  const d = useDirectorData();
  const event = d.event;
  const eventId = event?.id ?? '__none__';
  const tz = event?.timezone;
  const slots = useTable('meeting_slots', { eq: { eventId }, order: { column: 'startsAt' } });
  const bookings = useTable('meeting_bookings');
  const days = event ? dateRange(event.startsOn, event.endsOn) : [];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [day, setDay] = useState('');
  const [times, setTimes] = useState('');
  const [duration, setDuration] = useState('15');
  const [capacity, setCapacity] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const grouped = useMemo(() => [...new Set(slots.data.map((s) => localDateKey(s.startsAt, tz)))], [slots.data, tz]);
  const timeList = times
    .split(',')
    .map((t) => t.trim())
    .filter((t) => /^\d{1,2}:\d{2}$/.test(t));

  async function create() {
    if (!event) return;
    setBusy(true);
    setError(null);
    try {
      await backend.insert(
        'meeting_slots',
        timeList.map((t) => ({
          eventId: event.id,
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          startsAt: zonedToIso(day, t, event.timezone),
          durationMinutes: Number(duration) || 15,
          capacity: Math.max(1, Number(capacity) || 1),
        })),
      );
      setTimes('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen refreshing={slots.loading} onRefresh={() => (slots.refresh(), bookings.refresh())}>
      <H1>Meetings & sessions</H1>
      <Card>
        <H2 style={{ fontSize: 18 }}>Add time slots</H2>
        <Field label="Title" placeholder="Team photo session" value={title} onChangeText={setTitle} />
        <Field label="Details for families" value={description} onChangeText={setDescription} multiline />
        <Field label="Location" placeholder="Photo Tent" value={location} onChangeText={setLocation} />
        <Caption>Day</Caption>
        <Segmented value={day} onChange={setDay} options={days.map((x) => ({ value: x, label: formatDay(x) }))} />
        <Field label="Start times (24h, comma separated)" placeholder="09:00, 09:20, 09:40" value={times} onChangeText={setTimes} autoCapitalize="none" />
        <Row>
          <View style={{ flex: 1 }}>
            <Field label="Minutes" value={duration} onChangeText={setDuration} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Capacity per slot" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
          </View>
        </Row>
        <Button
          title={`Create ${timeList.length || ''} slot${timeList.length === 1 ? '' : 's'}`}
          icon="add"
          loading={busy}
          disabled={!title.trim() || !day || timeList.length === 0}
          onPress={create}
        />
        <ErrorNote message={error} />
      </Card>

      {grouped.map((g) => (
        <Section key={g} title={formatDay(g)}>
          {slots.data
            .filter((s) => localDateKey(s.startsAt, tz) === g)
            .map((s) => {
              const booked = bookings.data.filter((b) => b.slotId === s.id);
              return (
                <Card key={s.id} style={{ gap: S.sm }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <H3>{s.title}</H3>
                      <Caption>
                        {formatTime(s.startsAt, tz)} · {s.durationMinutes} min · {s.location}
                      </Caption>
                    </View>
                    <Badge label={`${booked.length}/${s.capacity}`} tone={booked.length >= s.capacity ? 'red' : 'navy'} />
                  </Row>
                  {booked.map((b) => (
                    <Body key={b.id}>
                      • {b.name}
                      {b.note ? ` — “${b.note}”` : ''}
                    </Body>
                  ))}
                  <Button
                    title="Delete slot"
                    variant="ghost"
                    small
                    onPress={async () => {
                      if (await confirmAction('Delete slot?', booked.length ? `${booked.length} booking(s) will be cancelled.` : s.title, 'Delete')) {
                        await backend.remove('meeting_bookings', booked.map((b) => b.id));
                        await backend.remove('meeting_slots', [s.id]);
                      }
                    }}
                  />
                </Card>
              );
            })}
        </Section>
      ))}
    </Screen>
  );
}
