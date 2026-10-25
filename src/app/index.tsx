import { Redirect } from 'expo-router';

import { Loading, Screen } from '@/components/ui';
import { useAuth } from '@/data';

export default function Index() {
  const { ready, profile } = useAuth();
  if (!ready) {
    return (
      <Screen scroll={false}>
        <Loading />
      </Screen>
    );
  }
  if (!profile) return <Redirect href="/welcome" />;
  return <Redirect href={profile.role === 'director' ? '/director' : '/fan'} />;
}
