import { RoleTabs, type TabDef } from '@/components/role-tabs';
import { useBackend } from '@/data';

export default function DirectorTabs() {
  const { features } = useBackend();
  const tabs: (TabDef | false)[] = [
    { name: 'index', title: 'Dashboard', icon: 'speedometer' },
    { name: 'checkin', title: 'Check-in', icon: features.rosters ? 'scan' : 'checkbox' },
    { name: 'schedule', title: 'Games', icon: 'baseball' },
    { name: 'teams', title: 'Teams', icon: 'people' },
    features.alerts && { name: 'messages', title: 'Alerts', icon: 'megaphone' },
    { name: 'more', title: 'More', icon: 'grid' },
  ];
  return <RoleTabs weekBar tabs={tabs.filter((t): t is TabDef => Boolean(t))} hidden={features.alerts ? [] : ['messages']} />;
}
