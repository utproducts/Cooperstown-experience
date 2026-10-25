import { router } from 'expo-router';

import { Badge, Button, Caption, Card, Divider, H1, H3, ListItem, Screen } from '@/components/ui';
import { useAuth } from '@/data';
import { useDirectorData } from '@/data/director';
import { toCsv } from '@/lib/csv';
import { shareTextFile } from '@/lib/share-file';

export default function DirectorMore() {
  const { profile, backend } = useAuth();
  const d = useDirectorData();

  function exportCheckIns() {
    const csv = toCsv(
      ['Team', 'Player', 'Jersey', 'Checked In', 'Checked In At'],
      d.players.map((p) => [d.teams.find((t) => t.id === p.teamId)?.name, `${p.firstName} ${p.lastName}`, p.jerseyNumber, p.checkedInAt ? 'Yes' : 'No', p.checkedInAt]),
    );
    shareTextFile('check-ins.csv', csv);
  }

  return (
    <Screen>
      <H1>More</H1>
      <Card>
        <H3>{profile?.name}</H3>
        <Caption>{profile?.email} · Director</Caption>
        {backend.mode === 'demo' && <Badge label="Demo mode — data is stored on this device" tone="gold" />}
      </Card>
      <Card style={{ gap: 0 }}>
        <ListItem icon="settings" title="Event settings" subtitle="Name, dates, venue, check-in window" onPress={() => router.push('/director/event')} />
        <Divider />
        <ListItem icon="people" title="Meetings & sessions" subtitle="Create slots and see who booked" onPress={() => router.push('/director/meetings')} />
        <Divider />
        <ListItem icon="camera" title="Photo packages & orders" onPress={() => router.push('/director/orders')} />
        <Divider />
        <ListItem icon="cloud-upload" title="Import registrations" subtitle="LeagueApps CSV export" onPress={() => router.push('/director/import')} />
        <Divider />
        <ListItem icon="construct" title="Schedule builder" onPress={() => router.push('/director/builder')} />
      </Card>
      <Card style={{ gap: 0 }}>
        <ListItem icon="download" title="Export check-ins (CSV)" onPress={exportCheckIns} />
        <Divider />
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
