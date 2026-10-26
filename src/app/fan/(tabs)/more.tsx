import { DemoRoleSwitch } from '@/components/demo-role-switch';
import { router } from 'expo-router';

import { Badge, Button, Caption, Card, Divider, H1, H3, ListItem, Screen } from '@/components/ui';
import { useAuth } from '@/data';

export default function More() {
  const { profile, backend } = useAuth();
  return (
    <Screen>
      <H1>More</H1>
      <Card>
        <H3>{profile?.id === 'guest' ? 'Browsing as a guest' : profile?.name}</H3>
        {profile?.email ? <Caption>{profile.email}</Caption> : <Caption>Your followed teams are saved on this phone.</Caption>}
        {backend.mode === 'demo' && <Badge label="Demo mode" tone="gold" />}
      </Card>
      <DemoRoleSwitch />
      <Card style={{ gap: 0 }}>
        <ListItem
          icon="shield"
          title="My teams"
          subtitle={backend.features.followCodes ? 'Follow a team with its code' : 'Find and follow your team'}
          onPress={() => router.push('/fan/teams')}
        />
        <Divider />
        {backend.features.alerts && (
          <>
            <ListItem icon="notifications" title="Alerts" subtitle="Weather, delays and announcements" onPress={() => router.push('/fan/alerts')} />
            <Divider />
          </>
        )}
        <ListItem icon="map" title="The Park" subtitle="Map, food, shop, ceremonies, things to do" onPress={() => router.push('/fan/park' as never)} />
        <Divider />
        <ListItem icon="receipt" title="My orders & reservations" subtitle="Food, shop orders and table requests" onPress={() => router.push('/fan/orders' as never)} />
        <Divider />
        {backend.features.meetings && (
          <>
            <ListItem icon="people" title="Meetings & sessions" subtitle="Book orientation, photo and office-hours slots" onPress={() => router.push('/fan/meetings')} />
            <Divider />
          </>
        )}
        {backend.features.photos && (
          <>
            <ListItem icon="camera" title="Photos" subtitle="Team photos, memory mates, trading cards" onPress={() => router.push('/fan/photos')} />
            <Divider />
          </>
        )}
        <ListItem icon="map" title="Week guide" subtitle="Itinerary, FAQ and places around town" onPress={() => router.push('/fan/guide')} />
        {profile?.role === 'director' && (
          <>
            <Divider />
            <ListItem icon="clipboard" title="Staff view" onPress={() => router.replace('/director')} />
          </>
        )}
      </Card>
      <Button
        title={profile?.id === 'guest' ? 'Back to the start' : 'Sign out'}
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
