import { NotificationItem } from '@/components/notification-item';
import { Body, Empty, H1, Screen } from '@/components/ui';
import { C } from '@/constants/theme';
import { useFanData } from '@/data/fan';

export default function FanAlerts() {
  const d = useFanData();
  return (
    <Screen refreshing={d.loading} onRefresh={d.refresh}>
      <H1>Alerts</H1>
      <Body style={{ color: C.muted }}>Announcements, weather, schedule changes and final scores for your teams.</Body>
      {d.notifications.length === 0 ? (
        <Empty icon="notifications-off-outline" title="No alerts yet" />
      ) : (
        d.notifications.map((n) => <NotificationItem key={n.id} n={n} />)
      )}
    </Screen>
  );
}
