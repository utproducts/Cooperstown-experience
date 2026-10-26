import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Badge, Body, Button, Caption, Card, ErrorNote, Field, H1, H2, Row, Screen, confirmAction, showMessage } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { useBackend, useCurrentEvent, useTable } from '@/data';
import type { EventWeek } from '@/data/types';
import { randomToken } from '@/lib/codes';
import { DEFAULT_TZ, localDateKey, relativeTime } from '@/lib/time';
import { generateSeasonWeeks, weekRange, weekStatus } from '@/lib/weeks';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULTS = {
  venue: 'Cooperstown, NY',
  address: 'Cooperstown, NY 13326',
  checkInWindow: '12:00 PM – 6:00 PM on arrival day',
  latitude: 42.7006,
  longitude: -74.9243,
};

export default function Weeks() {
  const week = useCurrentEvent();
  const teams = useTable('teams');
  const today = localDateKey(new Date().toISOString(), DEFAULT_TZ);
  const teamCount = (id: string) => teams.data.filter((t) => t.eventId === id).length;

  return (
    <Screen refreshing={week.loading} onRefresh={week.refresh}>
      <H1>Weeks</H1>
      <Body style={{ color: C.muted }}>
        Each tournament week is its own event with its own teams, check-ins, schedule and alerts. Pick the week you’re working on —
        every director screen follows it.
      </Body>

      <Card style={{ gap: S.sm }}>
        <H2 style={{ fontSize: 18 }}>Season ({week.events.length} weeks)</H2>
        {week.events.length === 0 && <Caption>No weeks yet — create the season below.</Caption>}
        {week.events.map((e) => {
          const active = e.id === week.data?.id;
          const status = weekStatus(e, today);
          return (
            <Pressable
              key={e.id}
              onPress={() => week.select(e.id)}
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', gap: S.sm, padding: S.md, borderRadius: R.md, borderWidth: 1, borderColor: active ? C.navy : C.border, backgroundColor: active ? C.navy : C.white },
                pressed && { opacity: 0.75 },
              ]}>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: '700', color: active ? C.white : C.ink }}>{e.name}</Body>
                <Caption style={active ? { color: '#C9D4E5' } : undefined}>
                  {weekRange(e)} · {teamCount(e.id)} teams
                </Caption>
              </View>
              {status === 'current' && <Badge label="This week" tone="green" />}
              {status === 'past' && <Badge label="Done" tone="muted" />}
              {active && <Badge label="Working on" tone="gold" />}
            </Pressable>
          );
        })}
      </Card>

      {week.data && <UmpireCodes key={`ump-${week.data.id}`} event={week.data} />}
      {week.data && <WeekForm key={week.data.id} event={week.data} teamCount={teamCount(week.data.id)} />}
      <SeasonGenerator existing={week.events} onCreated={(firstId) => firstId && !week.data && week.select(firstId)} />
    </Screen>
  );
}

function WeekForm({ event, teamCount }: { event: EventWeek; teamCount: number }) {
  const backend = useBackend();
  const week = useCurrentEvent();
  const [form, setForm] = useState({
    name: event.name,
    startsOn: event.startsOn,
    endsOn: event.endsOn,
    venue: event.venue,
    address: event.address,
    checkInWindow: event.checkInWindow,
    latitude: String(event.latitude),
    longitude: String(event.longitude),
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.name.trim() && DATE.test(form.startsOn) && DATE.test(form.endsOn) && form.endsOn >= form.startsOn;

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <H2 style={{ fontSize: 18, flex: 1 }}>Edit {event.name}</H2>
        <Badge label={event.published ? 'Public' : 'Hidden from families'} tone={event.published ? 'green' : 'warn'} />
      </Row>
      <Button
        title={event.published ? 'Hide from families' : 'Make public for families'}
        icon={event.published ? 'eye-off' : 'eye'}
        variant={event.published ? 'secondary' : 'dark'}
        small
        onPress={async () => {
          const msg = event.published ? 'Families won’t see this week’s schedule until it’s public again.' : 'Families and coaches will see the teams, schedule and scores.';
          if (await confirmAction(event.published ? 'Hide this week?' : 'Make this week public?', msg, event.published ? 'Hide' : 'Make public')) {
            await backend.update('events', event.id, { published: !event.published });
          }
        }}
      />
      <Field label="Name" value={form.name} onChangeText={set('name')} />
      <Row>
        <View style={{ flex: 1 }}>
          <Field label="Arrival (YYYY-MM-DD)" value={form.startsOn} onChangeText={set('startsOn')} autoCapitalize="none" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Departure (YYYY-MM-DD)" value={form.endsOn} onChangeText={set('endsOn')} autoCapitalize="none" />
        </View>
      </Row>
      <Field label="Venue" value={form.venue} onChangeText={set('venue')} />
      <Field label="Address" value={form.address} onChangeText={set('address')} />
      <Field label="Check-in window" value={form.checkInWindow} onChangeText={set('checkInWindow')} />
      <Row>
        <View style={{ flex: 1 }}>
          <Field label="Latitude (weather)" value={form.latitude} onChangeText={set('latitude')} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Longitude (weather)" value={form.longitude} onChangeText={set('longitude')} keyboardType="numbers-and-punctuation" />
        </View>
      </Row>
      <ErrorNote message={error} />
      <Button
        title="Save week"
        disabled={!valid}
        onPress={async () => {
          setError(null);
          try {
            await backend.update('events', event.id, {
              name: form.name.trim(),
              startsOn: form.startsOn,
              endsOn: form.endsOn,
              venue: form.venue.trim(),
              address: form.address.trim(),
              checkInWindow: form.checkInWindow.trim(),
              latitude: Number(form.latitude) || DEFAULTS.latitude,
              longitude: Number(form.longitude) || DEFAULTS.longitude,
            });
            showMessage('Saved');
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      />
      <Button
        title={teamCount ? `Delete week (has ${teamCount} teams)` : 'Delete week'}
        variant="danger"
        small
        disabled={teamCount > 0}
        onPress={async () => {
          if (!(await confirmAction('Delete week?', `${event.name} (${weekRange(event)}) will be removed.`, 'Delete'))) return;
          await backend.remove('events', [event.id]);
          week.select(null);
        }}
      />
      {teamCount > 0 && <Caption>Weeks with teams can’t be deleted, so registrations and check-ins are never lost by accident.</Caption>}
    </Card>
  );
}

function SeasonGenerator({ existing, onCreated }: { existing: EventWeek[]; onCreated: (firstId: string | null) => void }) {
  const backend = useBackend();
  const [first, setFirst] = useState('');
  const [count, setCount] = useState('16');
  const [days, setDays] = useState('6');
  const [breaks, setBreaks] = useState('0');
  const [label, setLabel] = useState('Week');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const drafts = DATE.test(first) ? generateSeasonWeeks(first, Math.min(30, Number(count) || 0), { daysPerWeek: Math.max(1, Number(days) || 6), breakDays: Math.max(0, Number(breaks) || 0), label: label.trim() || 'Week' }) : [];
  const overlaps = drafts.filter((d) => existing.some((e) => d.startsOn <= e.endsOn && e.startsOn <= d.endsOn));

  return (
    <Card>
      <H2 style={{ fontSize: 18 }}>Create a season of weeks</H2>
      <Caption>
        Cooperstown weeks are 6 days with no break days, so they roll: each week starts the day after the previous one ends, and Day 1 falls on a
        different weekday each week. Rename or adjust any week afterwards.
      </Caption>
      <Field label="First arrival day (YYYY-MM-DD)" placeholder="2027-05-29" value={first} onChangeText={setFirst} autoCapitalize="none" />
      <Row>
        <View style={{ flex: 1 }}>
          <Field label="Number of weeks" value={count} onChangeText={setCount} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Days per week" value={days} onChangeText={setDays} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Break days between weeks" value={breaks} onChangeText={setBreaks} keyboardType="number-pad" />
        </View>
      </Row>
      <Field label="Name prefix" value={label} onChangeText={setLabel} />
      {drafts.length > 0 && (
        <Caption>
          {drafts[0].name}: {weekRange(drafts[0])} … {drafts[drafts.length - 1].name}: {weekRange(drafts[drafts.length - 1])}
        </Caption>
      )}
      {overlaps.length > 0 && <Caption style={{ color: C.warn }}>{overlaps.length} of these overlap weeks that already exist and will be skipped.</Caption>}
      <ErrorNote message={error} />
      <Button
        title={`Create ${drafts.length - overlaps.length} weeks`}
        icon="calendar"
        loading={busy}
        disabled={drafts.length - overlaps.length <= 0}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            const rows = drafts.filter((d) => !overlaps.includes(d)).map((d) => ({ ...d, ...DEFAULTS, timezone: DEFAULT_TZ, published: false, settings: null }));
            const created = await backend.insert('events', rows);
            onCreated(created[0]?.id ?? null);
            showMessage('Season created', `${created.length} weeks added.`);
            setFirst('');
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Card>
  );
}

/** Each umpire (or crew) gets their own code for the week; the label shows who scored each game. */
function UmpireCodes({ event }: { event: EventWeek }) {
  const backend = useBackend();
  const codes = useTable('umpire_codes', { eq: { eventId: event.id } });
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <H2 style={{ fontSize: 18 }}>Umpire codes · {event.name}</H2>
      <Caption>
        Give each umpire or crew their own code. They open “Umpire? Enter scores” on the sign-in screen, enter it, and score their games with baseballs used. No
        account needed. Turning a code off stops it right away.
      </Caption>
      {codes.data.length === 0 && <Caption>No codes yet.</Caption>}
      {codes.data.map((c) => (
        <Row key={c.id} style={{ flexWrap: 'wrap', paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.border }}>
          <View style={{ flex: 1, minWidth: 160 }}>
            <Body selectable style={{ fontSize: 20, fontWeight: '800', letterSpacing: 2, color: c.active ? C.navy : C.muted }}>
              {c.code}
            </Body>
            <Caption>
              {c.label || 'No label'} · {c.lastUsedAt ? `last used ${relativeTime(c.lastUsedAt)}` : 'not used yet'}
            </Caption>
          </View>
          {!c.active && <Badge label="Off" tone="muted" />}
          <Button title="Copy" icon="copy" variant="secondary" small onPress={() => Clipboard.setStringAsync(c.code)} />
          <Button title={c.active ? 'Turn off' : 'Turn on'} variant="ghost" small onPress={() => backend.update('umpire_codes', c.id, { active: !c.active })} />
        </Row>
      ))}
      <Row style={{ alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field label="New code for" placeholder="e.g. Mike R. or Fields 7–12 crew" value={label} onChangeText={setLabel} maxLength={60} />
        </View>
        <Button
          title="Create code"
          icon="key"
          loading={busy}
          disabled={!label.trim()}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              await backend.insert('umpire_codes', [{ eventId: event.id, code: randomToken(6), label: label.trim(), active: true, lastUsedAt: null }]);
              setLabel('');
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </Row>
      <ErrorNote message={error} />
    </Card>
  );
}
