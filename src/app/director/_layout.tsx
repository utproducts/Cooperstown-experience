import { RoleStack } from '@/components/role-tabs';

export default function DirectorLayout() {
  return <RoleStack allow={['director']} home="/director" />;
}
