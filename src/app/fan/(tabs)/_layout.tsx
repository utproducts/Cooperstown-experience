import { RoleTabs, type TabDef } from '@/components/role-tabs';
import { useBackend } from '@/data';

export default function FanTabs() {
  const { features } = useBackend();
  const tabs: (TabDef | false)[] = [
    { name: 'index', title: 'Home', icon: 'home' },
    { name: 'schedule', title: 'Schedule', icon: 'calendar' },
    features.rosters && { name: 'player', title: 'Player', icon: 'qr-code' },
    features.alerts && { name: 'alerts', title: 'Alerts', icon: 'notifications' },
    { name: 'more', title: 'More', icon: 'grid' },
  ];
  return (
    <RoleTabs
      tabs={tabs.filter((t): t is TabDef => Boolean(t))}
      hidden={[!features.rosters && 'player', !features.alerts && 'alerts'].filter(Boolean) as string[]}
    />
  );
}
