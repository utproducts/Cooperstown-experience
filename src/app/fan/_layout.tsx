import { RoleStack } from '@/components/role-tabs';

export default function FanLayout() {
  return <RoleStack allow={['fan', 'coach', 'director']} home="/fan" />;
}
