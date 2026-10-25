import { router } from 'expo-router';

import { Badge, Button, Caption, Card, Divider, H1, H3, ListItem, Screen } from '@/components/ui';
import { useAuth } from '@/data';

export default function More() {
  const { profile, backend } = useAuth();
  return (
    <Screen>
      <H1>More</H1>
      <Card>
        <H3>{profile?.name}</H3>
        <Caption>{profile?.email}</Caption>
        {backend.mode === 'demo' && <Badge label="Demo mode" tone="gold" />}
      </Card>
      <Card style={{ gap: 0 }}>
        <ListItem icon="shield" title="My teams" subtitle="Follow a team with its code" onPress={() => router.push('/fan/teams')} />
        <Divider />
        <ListItem icon="people" title="Meetings & sessions" subtitle="Book orientation, photo and office-hours slots" onPress={() => router.push('/fan/meetings')} />
        <Divider />
        <ListItem icon="camera" title="Photos" subtitle="Team photos, memory mates, trading cards" onPress={() => router.push('/fan/photos')} />
        <Divider />
        <ListItem icon="map" title="Week guide" subtitle="Itinerary, FAQ and places around town" onPress={() => router.push('/fan/guide')} />
        {profile?.role === 'director' && (
          <>
            <Divider />
            <ListItem icon="clipboard" title="Director tools" onPress={() => router.replace('/director')} />
          </>
        )}
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
