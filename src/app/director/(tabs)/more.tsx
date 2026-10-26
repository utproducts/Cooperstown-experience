import { DemoRoleSwitch } from '@/components/demo-role-switch';
import { router } from 'expo-router';

import { Badge, Button, Caption, Card, Divider, H1, H3, ListItem, Screen } from '@/components/ui';
import { useAuth } from '@/data';
import { useDirectorData } from '@/data/director';
import { toCsv } from '@/lib/csv';
import { shareTextFile } from '@/lib/share-file';
import { uniformItems } from '@/lib/uniform';

export default function DirectorMore() {
  const { profile, backend } = useAuth();
  const d = useDirectorData();

  function exportCheckIns() {
    const items = uniformItems(d.event);
    const csv = toCsv(
      ['Team', 'Player', 'Jersey', ...items.map((i) => `${i} Size`), 'Checked In', 'Checked In At'],
      d.players.map((p) => [
        d.teams.find((t) => t.id === p.teamId)?.name,
        `${p.firstName} ${p.lastName}`,
        p.jerseyNumber,
        ...items.map((i) => p.uniform?.[i] ?? ''),
        p.checkedInAt ? 'Yes' : 'No',
        p.checkedInAt,
      ]),
    );
    shareTextFile('check-ins.csv', csv);
  }

  return (
    <Screen>
      <H1>More</H1>
      <Card>
        <H3>{profile?.name}</H3>
        <Caption>{profile?.email} · Staff</Caption>
        {backend.mode === 'demo' ? (
          <Badge label="Demo mode — data is stored on this device" tone="gold" />
        ) : (
          <Badge label="Connected to the Cooperstown database" tone="green" />
        )}
      </Card>
      <DemoRoleSwitch />
      <Card style={{ gap: 0 }}>
        <ListItem icon="map" title="Park & venue" subtitle="Map, orders, reservations, shop, menus, skills, bunkhouses, ceremonies" onPress={() => router.push('/director/venue' as never)} />
        <Divider />
        <ListItem icon="calendar" title="Weeks" subtitle="Switch weeks, publish, umpire codes, dates and venue" onPress={() => router.push('/director/event')} />
        <Divider />
        {backend.features.meetings && (
          <>
            <ListItem icon="people" title="Meetings & sessions" subtitle="Create slots and see who booked" onPress={() => router.push('/director/meetings')} />
            <Divider />
          </>
        )}
        {backend.features.photos && (
          <>
            <ListItem icon="camera" title="Photo packages & orders" onPress={() => router.push('/director/orders')} />
            <Divider />
          </>
        )}
        <ListItem icon="cloud-upload" title="Import registrations" subtitle="LeagueApps CSV export" onPress={() => router.push('/director/import')} />
        <Divider />
        <ListItem icon="construct" title="Schedule builder" onPress={() => router.push('/director/builder')} />
      </Card>
      <Card style={{ gap: 0 }}>
        {backend.features.rosters && (
          <>
            <ListItem icon="download" title="Export check-ins (CSV)" onPress={exportCheckIns} />
            <Divider />
          </>
        )}
        <ListItem icon="phone-portrait" title="Open family view" subtitle="See the app as parents see it" onPress={() => router.push('/fan')} />
      </Card>
      <Button
        title="Sign out"
        variant="danger"
        icon="log-out"
        onPress={async () => {
          await backend.signOut();
          router.replace('/welcome');
        }}
      />
    </Screen>
  );
}
