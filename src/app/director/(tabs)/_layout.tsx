import { RoleTabs } from '@/components/role-tabs';

export default function DirectorTabs() {
  return (
    <RoleTabs
      weekBar
      tabs={[
        { name: 'index', title: 'Dashboard', icon: 'speedometer' },
        { name: 'checkin', title: 'Check-in', icon: 'scan' },
        { name: 'schedule', title: 'Games', icon: 'baseball' },
        { name: 'teams', title: 'Teams', icon: 'people' },
        { name: 'messages', title: 'Alerts', icon: 'megaphone' },
        { name: 'more', title: 'More', icon: 'grid' },
      ]}
    />
  );
}
