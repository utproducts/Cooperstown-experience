import { DemoRoleSwitch } from '@/components/demo-role-switch';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GameCard } from '@/components/game-card';
import { NotificationItem } from '@/components/notification-item';
import { Badge, Body, Button, Caption, Card, Eyebrow, H3, Hero, Icon, Row, Screen, Section, type IconName } from '@/components/ui';
import { WeatherCard } from '@/components/weather-card';
import { FamilyWeekLabel } from '@/components/week-picker';
import { ITINERARY } from '@/content/guide';
import { C, R, S } from '@/constants/theme';
import { useAuth } from '@/data';
import type { Features } from '@/data/backend';
import { useFanData } from '@/data/fan';
import { useParkPhoto } from '@/data/venue';
import { dateRange, formatDay, localDateKey } from '@/lib/time';

const QUICK: { icon: IconName; label: string; href: string; needs?: keyof Features }[] = [
  { icon: 'qr-code', label: 'Check-in QR', href: '/fan/player', needs: 'rosters' },
  { icon: 'calendar', label: 'Schedule', href: '/fan/schedule' },
  { icon: 'people', label: 'Meetings', href: '/fan/meetings', needs: 'meetings' },
  { icon: 'camera', label: 'Photos', href: '/fan/photos', needs: 'photos' },
  { icon: 'fast-food', label: 'Order food', href: '/fan/food' },
  { icon: 'map', label: 'Park map', href: '/fan/map' },
  { icon: 'trophy', label: 'Skills comp', href: '/fan/skills' },
  { icon: 'book', label: 'Week guide', href: '/fan/guide' },
  { icon: 'add-circle', label: 'Follow team', href: '/fan/teams' },
];

export default function FanHome() {
  const { profile, backend } = useAuth();
  const d = useFanData();
  const photo = useParkPhoto(0);
  const event = d.event;
  const tz = event?.timezone;
  const today = localDateKey(new Date().toISOString(), tz);
  const days = event ? dateRange(event.startsOn, event.endsOn) : [];
  const dayIndex = days.indexOf(today);
  const daysUntil = event ? Math.ceil((new Date(`${event.startsOn}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86400000) : 0;

  const upcoming = d.myGames.filter((g) => g.status !== 'final' && g.status !== 'cancelled');
  const nextGame = upcoming[0];
  const live = d.myGames.find((g) => g.status === 'live');
  const todayItems = ITINERARY.filter((i) => i.day === dayIndex);
  const firstName = profile?.name?.split(' ')[0];

  let status = '';
  if (event) {
    if (daysUntil > 0) status = `${daysUntil} day${daysUntil === 1 ? '' : 's'} until arrival`;
    else if (dayIndex >= 0) status = `Day ${dayIndex + 1} of ${days.length} · ${formatDay(today)}`;
    else status = 'Thanks for a great week!';
  }

  return (
    <Screen refreshing={d.loading} onRefresh={d.refresh}>
      <DemoRoleSwitch />
      <Hero image={photo} tall eyebrow="Cooperstown" title={firstName ? `Welcome, ${firstName}` : 'Welcome'} subtitle={status}>
        <FamilyWeekLabel light />
        {d.myTeams.length > 0 && (
          <Row style={{ flexWrap: 'wrap', marginTop: S.sm }}>
            {d.myTeams.map((t) => (
              <View key={t.id} style={styles.teamChip}>
                <Icon name="shield" size={14} color={C.gold} />
                <Text style={styles.teamChipText}>{t.name}</Text>
              </View>
            ))}
          </Row>
        )}
      </Hero>

      {d.myTeamIds.length === 0 && (
        <Card style={{ borderColor: C.red }}>
          <H3>Follow your team</H3>
          <Body>
            {backend.features.followCodes
              ? 'Enter the team code from your invitation email to get your team’s schedule, scores and alerts.'
              : 'Pick your team to see its games, scores and bracket.'}
          </Body>
          <Button title={backend.features.followCodes ? 'Enter team code' : 'Find my team'} icon={backend.features.followCodes ? 'key' : 'search'} onPress={() => router.push('/fan/teams')} />
        </Card>
      )}

      {(live || nextGame) && (
        <Section title={live ? 'Playing now' : 'Next game'} action={<Button title="Full schedule" variant="ghost" small onPress={() => router.push('/fan/schedule')} />}>
          <GameCard game={(live ?? nextGame)!} teams={d.teams} highlightTeamIds={d.myTeamIds} timeZone={tz} showDay />
        </Section>
      )}

      <View style={styles.quickGrid}>
        {QUICK.filter((q) => !q.needs || backend.features[q.needs]).map((q) => (
          <Pressable key={q.label} style={({ pressed }) => [styles.quick, pressed && { opacity: 0.7 }]} onPress={() => router.push(q.href as never)}>
            <Icon name={q.icon} size={24} color={C.red} />
            <Text style={styles.quickText}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      {d.notifications.length > 0 && (
        <Section title="Latest" action={<Button title="All alerts" variant="ghost" small onPress={() => router.push('/fan/alerts')} />}>
          {d.notifications.slice(0, 2).map((n) => (
            <NotificationItem key={n.id} n={n} />
          ))}
        </Section>
      )}

      <WeatherCard event={event} />

      {todayItems.length > 0 && (
        <Card>
          <Eyebrow>Today at the park</Eyebrow>
          {todayItems.map((i) => (
            <Row key={i.title} style={{ alignItems: 'flex-start' }} gap={S.md}>
              <Icon name={i.icon} color={C.navy} />
              <View style={{ flex: 1 }}>
                <Row>
                  <H3>{i.title}</H3>
                  {i.time && <Badge label={i.time} />}
                </Row>
                <Caption>{i.detail}</Caption>
              </View>
            </Row>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  teamChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill },
  teamChipText: { color: C.white, fontWeight: '700', fontSize: 13 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  quick: {
    flexGrow: 1,
    flexBasis: '30%',
    backgroundColor: C.white,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: S.lg,
    alignItems: 'center',
    gap: 6,
  },
  quickText: { fontSize: 13, fontWeight: '700', color: C.navy },
});
