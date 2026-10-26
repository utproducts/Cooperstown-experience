import { useState } from 'react';

import { NotificationItem } from '@/components/notification-item';
import { Body, Button, Caption, Card, ErrorNote, Field, H1, H2, Row, Screen, Section, Segmented, confirmAction, showMessage } from '@/components/ui';
import { useForecast } from '@/components/weather-card';
import { C } from '@/constants/theme';
import { useBackend } from '@/data';
import { useDirectorData } from '@/data/director';
import { notify } from '@/data/services';
import type { NotificationKind } from '@/data/types';
import { describeWeather } from '@/lib/weather';

const TEMPLATES: { label: string; kind: NotificationKind; title: string; body: string }[] = [
  { label: 'Lightning hold', kind: 'weather', title: 'Lightning delay — all fields', body: 'Lightning detected within the safety radius. All games are on hold. Please seek shelter in vehicles or buildings. We will update you in 30 minutes.' },
  { label: 'All clear', kind: 'weather', title: 'All clear — play resumes', body: 'Play resumes in 20 minutes. Game times have been adjusted in the schedule.' },
  { label: 'Heat advisory', kind: 'weather', title: 'Heat advisory today', body: 'High heat expected this afternoon. Water stations are at every field. Hats and sunscreen strongly recommended.' },
  { label: 'Rain-out', kind: 'schedule', title: 'Games postponed for rain', body: 'Fields are unplayable. Remaining games today are postponed. New times will be posted tonight.' },
  { label: 'Ceremony reminder', kind: 'general', title: 'Opening Ceremonies tomorrow', body: 'Teams line up behind their banners at 7:00 AM ET in full uniform. Ceremonies begin at 7:30 AM ET.' },
];

export default function Messages() {
  const backend = useBackend();
  const d = useDirectorData();
  const { forecast } = useForecast(d.event);
  const [kind, setKind] = useState<NotificationKind>('general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'all' | 'teams'>('all');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recipients = audience === 'all' ? d.teams.length : teamIds.length;

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
    if (!d.event) return;
    const who = audience === 'all' ? 'everyone at the event' : `${teamIds.length} team${teamIds.length === 1 ? '' : 's'}`;
    if (!(await confirmAction('Send push notification?', `“${title}” goes to ${who}.`, 'Send'))) return;
    setBusy(true);
    setError(null);
    try {
      await notify(backend, d.event.id, { kind, title: title.trim(), body: body.trim(), teamIds: audience === 'all' ? [] : teamIds });
      setTitle('');
      setBody('');
      showMessage('Sent', `Notification delivered to ${who}.`);
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
        <H2 style={{ fontSize: 18 }}>New push notification</H2>
        <Caption>Templates</Caption>
        <Row style={{ flexWrap: 'wrap' }} gap={6}>
          <Button title="Current forecast" icon="partly-sunny" small variant="secondary" disabled={!forecast} onPress={applyForecastTemplate} />
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
        {audience === 'teams' && (
          <Row style={{ flexWrap: 'wrap' }} gap={6}>
            {d.teams.map((t) => (
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
        <Button title={`Send to ${audience === 'all' ? 'everyone' : `${recipients} teams`}`} icon="send" loading={busy} disabled={!title.trim() || !body.trim() || recipients === 0} onPress={send} />
        <ErrorNote message={error} />
        <Body style={{ color: C.muted, fontSize: 13 }}>
          Delays and time changes made from the Games tab are sent automatically to the affected teams — no need to post them here.
        </Body>
      </Card>

      <Section title="Sent">
        {d.notifications.map((n) => (
          <NotificationItem key={n.id} n={n} audience={n.teamIds.length === 0 ? 'Everyone' : n.teamIds.map((id) => d.teams.find((t) => t.id === id)?.name ?? '').join(', ')} />
        ))}
      </Section>
    </Screen>
  );
}
