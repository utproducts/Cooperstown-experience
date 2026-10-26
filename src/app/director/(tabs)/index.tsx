import { DemoRoleSwitch } from '@/components/demo-role-switch';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GameCard } from '@/components/game-card';
import { GameEditor } from '@/components/game-editor';
import { NotificationItem } from '@/components/notification-item';
import { Body, Button, Caption, Card, Empty, Eyebrow, Hero, Icon, Progress, Row, Screen, Section, Stat, type IconName } from '@/components/ui';
import { WeatherCard } from '@/components/weather-card';
import { C, R, S } from '@/constants/theme';
import { useBackend, useTable } from '@/data';
import { useDirectorData } from '@/data/director';
import type { Game } from '@/data/types';
import { useParkPhoto } from '@/data/venue';
import { dateRange, formatDay, localDateKey } from '@/lib/time';
import { useNow } from '@/lib/use-now';

const ACTIONS: { icon: IconName; label: string; href: string; alerts?: boolean }[] = [
  { icon: 'scan', label: 'Scan check-in', href: '/director/checkin' },
  { icon: 'cloud-upload', label: 'Import registrations', href: '/director/import' },
  { icon: 'construct', label: 'Build schedule', href: '/director/builder' },
  { icon: 'megaphone', label: 'Send alert', href: '/director/messages', alerts: true },
];

export default function DirectorDashboard() {
  const d = useDirectorData();
  const backend = useBackend();
  const teamCheckins = useTable('team_checkins');
  const [editing, setEditing] = useState<Game | null>(null);
  const now = useNow();
  const photo = useParkPhoto(1);
  const event = d.event;
  const tz = event?.timezone;
  const today = localDateKey(new Date(now).toISOString(), tz);
  // Player check-in once a roster is in; team check-in (Cooperstown's checklist) until then.
  const byTeams = !backend.features.rosters || d.players.length === 0;
  const checkUnits = byTeams ? d.teams.length : d.players.length;
  const checked = byTeams ? teamCheckins.data.filter((c) => c.checkedInAt && d.teams.some((t) => t.id === c.teamId)).length : d.players.filter((p) => p.checkedInAt).length;
  const todays = d.games.filter((g) => localDateKey(g.startsAt, tz) === today);
  const live = todays.filter((g) => g.status === 'live');
  const needsScore = d.games.filter((g) => g.status !== 'final' && g.status !== 'cancelled' && g.status !== 'postponed' && new Date(g.startsAt).getTime() + 2 * 3600e3 < now);
  const upcoming = todays.filter((g) => g.status === 'scheduled' || g.status === 'delayed').slice(0, 4);
  const days = event ? dateRange(event.startsOn, event.endsOn) : [];
  const dayIdx = days.indexOf(today);

  return (
    <Screen refreshing={d.loading} onRefresh={d.refresh}>
      <DemoRoleSwitch />
      <Hero
        image={photo}
        eyebrow="Staff view"
        title={event?.name ?? 'No event yet'}
        subtitle={event ? `${formatDay(event.startsOn)} – ${formatDay(event.endsOn)}${dayIdx >= 0 ? ` · Day ${dayIdx + 1}` : ''} · ${event.venue}` : 'Create the season’s weeks under More → Weeks'}
      />

      <View style={styles.actions}>
        {ACTIONS.filter((a) => !a.alerts || backend.features.alerts).map((a) => (
          <Pressable key={a.label} onPress={() => router.push(a.href as never)} style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}>
            <Icon name={a.icon} size={22} color={C.white} />
            <Text style={styles.actionText}>{a.label}</Text>
          </Pressable>
        ))}
      </View>

      <Card>
        <Row style={{ flexWrap: 'wrap' }} gap={S.lg}>
          <Stat label="Teams" value={d.teams.length} />
          {!byTeams && <Stat label="Players" value={d.players.length} />}
          <Stat label="Checked in" value={`${checked}`} tone={C.green} />
          <Stat label="Games today" value={todays.length} tone={C.red} />
        </Row>
        <Progress value={checkUnits ? checked / checkUnits : 0} />
        <Caption>
          {checkUnits ? Math.round((checked / checkUnits) * 100) : 0}% of {byTeams ? 'teams' : 'players'} checked in · {checkUnits - checked} remaining
        </Caption>
      </Card>

      {needsScore.length > 0 && (
        <Section title={`Needs a final score (${needsScore.length})`}>
          {needsScore.slice(0, 3).map((g) => (
            <GameCard key={g.id} game={g} teams={d.teams} timeZone={tz} onPress={() => setEditing(g)} showDay />
          ))}
        </Section>
      )}

      <Section title={live.length ? 'Live now' : 'Up next today'} action={<Button title="All games" variant="ghost" small onPress={() => router.push('/director/schedule')} />}>
        {(live.length ? live : upcoming).length === 0 ? (
          <Card>
            <Empty icon="baseball-outline" title="No more games today" />
          </Card>
        ) : (
          (live.length ? live : upcoming).map((g) => <GameCard key={g.id} game={g} teams={d.teams} timeZone={tz} onPress={() => setEditing(g)} />)
        )}
      </Section>

      <WeatherCard event={event} />

      {backend.features.alerts && (
      <Section title="Recent alerts" action={<Button title="Compose" variant="ghost" small icon="create" onPress={() => router.push('/director/messages')} />}>
        {d.notifications.slice(0, 3).map((n) => (
          <NotificationItem key={n.id} n={n} audience={n.teamIds.length === 0 ? 'Everyone' : n.teamIds.map((id) => d.teams.find((t) => t.id === id)?.name ?? '').join(', ')} />
        ))}
        {d.notifications.length === 0 && <Body style={{ color: C.muted }}>No alerts sent yet.</Body>}
      </Section>
      )}

      {event && (
        <Card style={{ backgroundColor: C.navy, borderColor: C.navy }}>
          <Eyebrow style={{ color: C.gold }}>Family app</Eyebrow>
          <Body style={{ color: C.white }}>See exactly what parents and coaches see.</Body>
          <Button title="Open family view" variant="secondary" icon="phone-portrait" onPress={() => router.push('/fan')} />
        </Card>
      )}

      {editing && event && <GameEditor key={editing.id} game={editing} event={event} teams={d.teams} games={d.games} onClose={() => setEditing(null)} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  action: { flexGrow: 1, flexBasis: '45%', backgroundColor: C.red, borderRadius: R.md, padding: S.lg, gap: S.sm },
  actionText: { color: C.white, fontWeight: '800', fontSize: 15 },
});
