import { router } from 'expo-router';
import { useState } from 'react';

import { Body, Button, Card, ErrorNote, Field, H1, Screen, showMessage } from '@/components/ui';
import { C } from '@/constants/theme';
import { useBackend, useCurrentEvent } from '@/data';
import type { EventWeek } from '@/data/types';
import { DEFAULT_TZ } from '@/lib/time';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function EventSettings() {
  const { data: event, loading } = useCurrentEvent();
  if (loading) return null;
  return <EventForm key={event?.id ?? 'new'} event={event} />;
}

function EventForm({ event }: { event: EventWeek | null }) {
  const backend = useBackend();
  const [form, setForm] = useState(() =>
    event
      ? {
          name: event.name,
          startsOn: event.startsOn,
          endsOn: event.endsOn,
          venue: event.venue,
          address: event.address,
          checkInWindow: event.checkInWindow,
          latitude: String(event.latitude),
          longitude: String(event.longitude),
        }
      : {
          name: '',
          startsOn: '',
          endsOn: '',
          venue: 'Cooperstown, NY',
          address: 'Cooperstown, NY 13326',
          checkInWindow: '12:00 PM – 6:00 PM on arrival day',
          latitude: '42.7006',
          longitude: '-74.9243',
        },
  );
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.name.trim() && DATE.test(form.startsOn) && DATE.test(form.endsOn) && form.endsOn >= form.startsOn;

  async function save(asNew: boolean) {
    setError(null);
    const row = {
      name: form.name.trim(),
      startsOn: form.startsOn,
      endsOn: form.endsOn,
      venue: form.venue.trim(),
      address: form.address.trim(),
      checkInWindow: form.checkInWindow.trim(),
      latitude: Number(form.latitude) || 42.7006,
      longitude: Number(form.longitude) || -74.9243,
      timezone: event?.timezone ?? DEFAULT_TZ,
    };
    try {
      if (event && !asNew) await backend.update('events', event.id, row);
      else await backend.insert('events', [row]);
      showMessage(asNew ? 'Event created' : 'Saved');
      router.back();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Screen>
      <H1>Event settings</H1>
      <Card>
        <Field label="Event name" placeholder="Week 7 · 12U" value={form.name} onChangeText={set('name')} />
        <Field label="Arrival day (YYYY-MM-DD)" value={form.startsOn} onChangeText={set('startsOn')} autoCapitalize="none" />
        <Field label="Departure day (YYYY-MM-DD)" value={form.endsOn} onChangeText={set('endsOn')} autoCapitalize="none" />
        <Field label="Venue" value={form.venue} onChangeText={set('venue')} />
        <Field label="Address" value={form.address} onChangeText={set('address')} />
        <Field label="Check-in window" value={form.checkInWindow} onChangeText={set('checkInWindow')} />
        <Field label="Latitude (for weather)" value={form.latitude} onChangeText={set('latitude')} keyboardType="numbers-and-punctuation" />
        <Field label="Longitude (for weather)" value={form.longitude} onChangeText={set('longitude')} keyboardType="numbers-and-punctuation" />
        <ErrorNote message={error} />
        {event && <Button title="Save changes" disabled={!valid} onPress={() => save(false)} />}
        <Button title="Create as a new week" variant={event ? 'secondary' : 'primary'} disabled={!valid} onPress={() => save(true)} />
        <Body style={{ color: C.muted, fontSize: 13 }}>
          Each tournament week is its own event. Directors always work on the most recent week; teams and families stay attached to their own week.
        </Body>
      </Card>
    </Screen>
  );
}
