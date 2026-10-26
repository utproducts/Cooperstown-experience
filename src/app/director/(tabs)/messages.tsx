import { useState } from 'react';

import { NotificationItem } from '@/components/notification-item';
import { Body, Button, Caption, Card, ErrorNote, Field, H1, H2, Row, Screen, Section, Segmented, confirmAction, showMessage } from '@/components/ui';
import { useForecast } from '@/components/weather-card';
import { C } from '@/constants/theme';
import { useBackend, useCurrentEvent, useTable } from '@/data';
import { useDirectorData } from '@/data/director';
import { notify } from '@/data/services';
import type { EventWeek, NotificationKind } from '@/data/types';
import { DEFAULT_TZ, localDateKey } from '@/lib/time';
import { describeWeather } from '@/lib/weather';
import { alertWeekOptions, weekRange } from '@/lib/weeks';

const TEMPLATES: { label: string; kind: NotificationKind; title: string; body: string }[] = [
  { label: 'Lightning hold', kind: 'weather', title: 'Lightning delay — all fields', body: 'Lightning detected within the safety radius. All games are on hold. Please seek shelter in vehicles or buildings. We will update you in 30 minutes.' },
  { label: 'All clear', kind: 'weather', title: 'All clear — play resumes', body: 'Play resumes in 20 minutes. Game times have been adjusted in the schedule.' },
  { label: 'Heat advisory', kind: 'weather', title: 'Heat advisory today', body: 'High heat expected this afternoon. Water stations are at every field. Hats and sunscreen strongly recommended.' },
  { label: 'Rain-out', kind: 'schedule', title: 'Games postponed for rain', body: 'Fields are unplayable. Remaining games today are postponed. New times will be posted tonight.' },
  { label: 'Ceremony reminder', kind: 'general', title: 'Opening Ceremonies tomorrow', body: 'Teams line up behind their banners at 7:00 AM ET in full uniform. Ceremonies begin at 7:30 AM ET.' },
];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Welcome message for a week's families, filled in with that week's dates and check-in. */
const welcome = (w: EventWeek) => ({
  kind: 'general' as const,
  title: `Welcome to ${w.name} in Cooperstown!`,
  body: `Your week is ${weekRange(w)}. Check-in: ${w.checkInWindow} at ${w.venue}. Your schedule, scores and alerts are in this app. See you soon!`,
});

export default function Messages() {
  const backend = useBackend();
  const d = useDirectorData();
  const weeks = useCurrentEvent();
  const today = localDateKey(new Date().toISOString(), d.event?.timezone ?? DEFAULT_TZ);
  const options = alertWeekOptions(weeks.events, today);
  // Which week's families get this alert: the week being worked on unless the director picks another.
  const [targetId, setTargetId] = useState<string | null>(null);
  const target = weeks.events.find((e) => e.id === (targetId ?? d.event?.id)) ?? null;
  const targetTag = options.find((o) => o.week.id === target?.id)?.tag ?? null;
  const targetTeams = useTable('teams', { eq: { eventId: target?.id ?? '__none__' }, order: { column: 'name' } });
  const sent = useTable('notifications', { eq: { eventId: target?.id ?? '__none__' }, order: { column: 'createdAt', ascending: false } });
  const [teamQuery, setTeamQuery] = useState('');
  const { forecast } = useForecast(d.event);
  const [kind, setKind] = useState<NotificationKind>('general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'teams'>('all');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teams = targetTeams.data;
  const recipients = audience === 'all' ? teams.length : teamIds.filter((id) => teams.some((t) => t.id === id)).length;
  const weekLabel = target ? `${target.name} (${weekRange(target)})` : '';
  const shownTeams = teams.filter((t) => `${t.name} ${t.organization ?? ''} ${t.state}`.toLowerCase().includes(teamQuery.trim().toLowerCase()));

  function pickWeek(id: string) {
    setTargetId(id);
    // Teams belong to one week, so a team pick doesn't carry over.
    setTeamIds([]);
    setTeamQuery('');
  }

  function applyForecastTemplate() {
    if (!forecast) return;
    const now = describeWeather(forecast.current.code);
    const today = forecast.daily[0];
    setKind('weather');
    setTitle(`Weather update: ${now.label}, ${forecast.current.tempF}°F`);
    setBody(
      `Today: high ${today?.highF}°, low ${today?.lowF}°, ${today?.precipChance ?? 0}% chance of rain.` +
        (forecast.stormHours.length ? ' Thunderstorms possible later today — we will send updates if play is affected.' : ' No storms expected.'),
    );
  }

  async function send() {
    if (!target) return;
    const who = audience === 'all' ? `every team in ${weekLabel}, ${plural(teams.length, 'team')}` : `${plural(recipients, 'team')} in ${weekLabel}`;
    if (!(await confirmAction(`Send alert to ${target.name}?`, `“${title.trim()}” goes to ${who}.`, 'Send'))) return;
    setBusy(true);
    setError(null);
    try {
      await notify(backend, target.id, { kind, title: title.trim(), body: body.trim(), teamIds: audience === 'all' ? [] : teamIds.filter((id) => teams.some((t) => t.id === id)) });
      setTitle('');
      setBody('');
      showMessage('Sent', `Sent to ${who}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen refreshing={d.loading} onRefresh={d.refresh}>
      <H1>Alerts</H1>
      <Card>
        <H2 style={{ fontSize: 18 }}>New alert</H2>
        <Caption>Families see it in their Alerts tab{backend.features.push ? ' and as a push notification on their phone' : ''}.</Caption>
        <Caption>Which week’s families</Caption>
        <Segmented
          value={target?.id ?? ''}
          onChange={pickWeek}
          options={options.map((o) => ({ value: o.week.id, label: o.tag ? `${o.tag} · ${o.week.name}` : o.week.name }))}
        />
        {target && (
          <Caption>
            {target.name} · {weekRange(target)} · {plural(teams.length, 'team')}{targetTag ? ` · ${targetTag.toLowerCase()}` : ''}
          </Caption>
        )}
        <Caption>Templates</Caption>
        <Row style={{ flexWrap: 'wrap' }} gap={6}>
          {target && <Button title="Welcome" icon="hand-right" small variant="secondary" onPress={() => { const w = welcome(target); setKind(w.kind); setTitle(w.title); setBody(w.body); }} />}
          <Button title="Current forecast" icon="partly-sunny" small variant="secondary" disabled={!forecast || targetTag !== 'This week'} onPress={applyForecastTemplate} />
          {TEMPLATES.map((t) => (
            <Button key={t.label} title={t.label} small variant="secondary" onPress={() => (setKind(t.kind), setTitle(t.title), setBody(t.body))} />
          ))}
        </Row>
        <Caption>Type</Caption>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'general', label: 'Announcement' },
            { value: 'weather', label: 'Weather' },
            { value: 'schedule', label: 'Schedule' },
          ]}
        />
        <Field label="Title" value={title} onChangeText={setTitle} maxLength={80} placeholder="Short headline shown on the lock screen" />
        <Field label="Message" value={body} onChangeText={setBody} multiline maxLength={500} />
        <Caption>Send to</Caption>
        <Segmented
          value={audience}
          onChange={setAudience}
          options={[
            { value: 'all', label: 'Everyone' },
            { value: 'teams', label: 'Specific teams' },
          ]}
        />
        {audience === 'teams' && teams.length > 12 && (
          <Field placeholder={`Search ${teams.length} teams in ${target?.name ?? 'this week'}`} value={teamQuery} onChangeText={setTeamQuery} autoCorrect={false} />
        )}
        {audience === 'teams' && (
          <Row style={{ flexWrap: 'wrap' }} gap={6}>
            {shownTeams.slice(0, 60).map((t) => (
              <Button
                key={t.id}
                title={t.name}
                small
                variant={teamIds.includes(t.id) ? 'dark' : 'secondary'}
                onPress={() => setTeamIds(teamIds.includes(t.id) ? teamIds.filter((x) => x !== t.id) : [...teamIds, t.id])}
              />
            ))}
          </Row>
        )}
        {target && (
          <Card style={{ backgroundColor: C.goldSoft, borderColor: '#EAD9A0', gap: 2 }}>
            <Body style={{ fontWeight: '700' }}>Goes to {target.name}</Body>
            <Caption>
              {weekRange(target)} · {audience === 'all' ? `all ${plural(teams.length, 'team')}` : `${recipients} of ${plural(teams.length, 'team')}`}
            </Caption>
          </Card>
        )}
        <Button
          title={target ? `Send to ${audience === 'all' ? 'all of' : `${plural(recipients, 'team')} in`} ${target.name}` : 'Pick a week'}
          icon="send"
          loading={busy}
          disabled={!target || !title.trim() || !body.trim() || recipients === 0}
          onPress={send}
        />
        <ErrorNote message={error} />
        <Body style={{ color: C.muted, fontSize: 13 }}>
          Delays and time changes made from the Games tab are sent automatically to the affected teams — no need to post them here.
        </Body>
      </Card>

      <Section title={target ? `Sent to ${target.name}` : 'Sent'}>
        {sent.data.length === 0 && <Caption>Nothing sent to {target?.name ?? 'this week'} yet.</Caption>}
        {sent.data.map((n) => (
          <NotificationItem
            key={n.id}
            n={n}
            audience={n.teamIds.length === 0 ? `Everyone in ${target?.name}` : n.teamIds.map((id) => teams.find((t) => t.id === id)?.name ?? '').join(', ')}
          />
        ))}
      </Section>
    </Screen>
  );
}
