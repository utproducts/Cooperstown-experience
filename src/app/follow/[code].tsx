import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Body, Button, Card, Empty, ErrorNote, H1, Loading, Screen } from '@/components/ui';
import { useAuth } from '@/data';
import { normalizeTeamCode } from '@/lib/codes';

/** Deep link target for the invite email: /follow/RAYS-7K2Q */
export default function FollowLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { profile, ready, backend } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);

  useEffect(() => {
    if (!profile || !code) return;
    backend
      .followTeam(code)
      .then((t) => setTeamName(t.name))
      .catch((e: Error) => setError(e.message));
  }, [profile, code, backend]);

  if (!ready) return <Loading />;
  if (!profile) return <Redirect href={{ pathname: '/welcome', params: { next: `/follow/${code}` } }} />;

  return (
    <Screen>
      <H1>Follow team</H1>
      <Card>
        {error ? (
          <>
            <ErrorNote message={error} />
            <Body>Double-check the code in your invitation email: {normalizeTeamCode(code ?? '')}</Body>
            <Button title="Enter a code manually" onPress={() => router.replace('/fan/teams')} />
          </>
        ) : teamName ? (
          <Empty
            icon="checkmark-circle"
            title={`You're following ${teamName}`}
            body="You'll get schedule changes, scores and announcements for this team."
            action={<Button title="Go to my team" onPress={() => router.replace('/fan')} />}
          />
        ) : (
          <Loading />
        )}
      </Card>
    </Screen>
  );
}
