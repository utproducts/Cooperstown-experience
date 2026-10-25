import { RoleTabs } from '@/components/role-tabs';

export default function FanTabs() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'Home', icon: 'home' },
        { name: 'schedule', title: 'Schedule', icon: 'calendar' },
        { name: 'player', title: 'Player', icon: 'qr-code' },
        { name: 'alerts', title: 'Alerts', icon: 'notifications' },
        { name: 'more', title: 'More', icon: 'grid' },
      ]}
    />
  );
}
