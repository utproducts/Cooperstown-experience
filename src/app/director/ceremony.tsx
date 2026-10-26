import { useState } from 'react';
import { View } from 'react-native';

import { TimeSelect } from '@/components/time-select';
import { Button, Caption, Card, ErrorNote, Field, H1, Row, Screen, showMessage } from '@/components/ui';
import { useBackend } from '@/data';
import { useDirectorData } from '@/data/director';
import type { EventWeek } from '@/data/types';
import { usePlaces } from '@/data/venue';
import { dateRange, formatDay } from '@/lib/time';
import { weekCeremony } from '@/lib/venue';

/** Staff: this week's Opening Ceremonies (saved with the week). */
export default function CeremonyAdmin() {
  const d = useDirectorData();
  if (!d.event) return <Screen><H1>Opening Ceremonies</H1><Caption>Create the season’s weeks first.</Caption></Screen>;
  return <CeremonyForm key={d.event.id} event={d.event} />;
}

function CeremonyForm({ event }: { event: EventWeek }) {
  const backend = useBackend();
  const fields = usePlaces('field');
  const c = weekCeremony(event.settings);
  const days = dateRange(event.startsOn, event.endsOn);
  // Keyed by week, so the form starts from that week's saved ceremony.
  const [date, setDate] = useState(c?.date ?? event.startsOn);
  const [time, setTime] = useState(c?.time ?? '19:00');
  const [placeId, setPlaceId] = useState<string | null>(c?.placeId ?? null);
  const [headline, setHeadline] = useState(c?.headline ?? '');
  const [schedule, setSchedule] = useState(c?.schedule ?? [{ time: '19:00', title: 'Parade of teams' }]);
  const [expect, setExpect] = useState((c?.expect ?? []).join('\n'));
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen>
      <H1>Opening Ceremonies</H1>
      <Caption>{event.name}: families see this on the Park tab.</Caption>
      <Card>
        <Caption>Day</Caption>
        <Row style={{ flexWrap: 'wrap' }} gap={6}>
          {days.map((x, i) => (
            <Button key={x} title={`Day ${i + 1} · ${formatDay(x)}`} small variant={date === x ? 'dark' : 'secondary'} onPress={() => setDate(x)} />
          ))}
        </Row>
        <TimeSelect label="Starts" value={time} onChange={setTime} step={15} timeZone={event.timezone} />
        <Caption>Field</Caption>
        <Row style={{ flexWrap: 'wrap' }} gap={6}>
          {fields.data.map((f) => (
            <Button key={f.id} title={f.name} small variant={placeId === f.id ? 'dark' : 'secondary'} onPress={() => setPlaceId(f.id)} />
          ))}
          {fields.data.length === 0 && <Caption>Add fields under Site map & places to pick one.</Caption>}
        </Row>
        <Field label="Headline" value={headline} onChangeText={setHeadline} placeholder="Every team parades in behind its banner…" />
      </Card>
      <Card>
        <Caption style={{ fontWeight: '700' }}>Run of show</Caption>
        {schedule.map((s, i) => (
          <View key={i} style={{ gap: 6 }}>
            <TimeSelect value={s.time} onChange={(v) => setSchedule((x) => x.map((y, j) => (j === i ? { ...y, time: v } : y)))} step={15} timeZone={event.timezone} />
            <Row>
              <View style={{ flex: 1 }}>
                <Field value={s.title} onChangeText={(v) => setSchedule((x) => x.map((y, j) => (j === i ? { ...y, title: v } : y)))} placeholder="What happens" />
              </View>
              <Button title="Remove" small variant="ghost" onPress={() => setSchedule((x) => x.filter((_, j) => j !== i))} />
            </Row>
          </View>
        ))}
        <Button title="Add a step" icon="add" small variant="secondary" onPress={() => setSchedule((x) => [...x, { time: x.at(-1)?.time ?? time, title: '' }])} />
      </Card>
      <Field label="What to expect (one per line)" value={expect} onChangeText={setExpect} multiline placeholder={'Players in full uniform\nBring a blanket'} />
      <ErrorNote message={error} />
      <Button
        title="Save Opening Ceremonies"
        icon="flag"
        onPress={async () => {
          setError(null);
          try {
            await backend.update('events', event.id, {
              settings: {
                ...(event.settings ?? {}),
                ceremony: {
                  date,
                  time,
                  placeId,
                  headline: headline.trim(),
                  schedule: schedule.filter((s) => s.title.trim()).sort((a, b) => a.time.localeCompare(b.time)),
                  expect: expect.split('\n').map((x) => x.trim()).filter(Boolean),
                },
              },
            });
            showMessage('Saved', 'Families see the updated Opening Ceremonies now.');
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      />
    </Screen>
  );
}
