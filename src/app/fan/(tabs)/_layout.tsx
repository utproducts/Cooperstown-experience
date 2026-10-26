import { RoleTabs, type TabDef } from '@/components/role-tabs';
import { useBackend } from '@/data';

export default function FanTabs() {
  const { features } = useBackend();
  const tabs: (TabDef | false)[] = [
    { name: 'index', title: 'Home', icon: 'home' },
    { name: 'schedule', title: 'Schedule', icon: 'calendar' },
    { name: 'park', title: 'Park', icon: 'map' },
    features.rosters && { name: 'player', title: 'Player', icon: 'qr-code' },
    { name: 'more', title: 'More', icon: 'grid' },
  ];
  // Alerts open from Home, More and push notifications (/fan/alerts), so they don't take a tab.
  return <RoleTabs tabs={tabs.filter((t): t is TabDef => Boolean(t))} hidden={['alerts', ...(features.rosters ? [] : ['player'])]} />;
}
