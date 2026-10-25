import { Fragment, useState } from 'react';

import { Body, Button, Caption, Card, Divider, ErrorNote, Field, H1, H3, ListItem, Screen, confirmAction } from '@/components/ui';
import { C } from '@/constants/theme';
import { useAuth, useTable } from '@/data';
import { useFanData } from '@/data/fan';
import { normalizeTeamCode } from '@/lib/codes';

export default function MyTeams() {
  const { backend, profile } = useAuth();
  const d = useFanData();
  const follows = useTable('follows', { eq: { userId: profile?.id ?? '' } });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function follow() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const team = await backend.followTeam(code);
      setSuccess(`You're now following ${team.name}.`);
      setCode('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <H1>My teams</H1>
      <Card>
        <H3>Follow a team</H3>
        <Body style={{ color: C.muted }}>Your team code is in the invitation email from the tournament (e.g. RAYS-7K2Q).</Body>
        <Field
          placeholder="TEAM-CODE"
          autoCapitalize="characters"
          autoCorrect={false}
          value={code}
          onChangeText={(t) => setCode(normalizeTeamCode(t))}
          onSubmitEditing={follow}
        />
        <Button title="Follow team" icon="add-circle" loading={busy} disabled={code.length < 6} onPress={follow} />
        {backend.mode === 'demo' && <Caption>Demo codes: STOR-7K2Q, THUN-M4TX, OUTL-H8RN</Caption>}
        <ErrorNote message={error} />
        {success && <Body style={{ color: C.green, fontWeight: '700' }}>{success}</Body>}
      </Card>
      <Card style={{ gap: 0 }}>
        <H3>Following</H3>
        {d.myTeams.length === 0 && <Caption>You’re not following any teams yet.</Caption>}
        {d.myTeams.map((t, i) => {
          const f = follows.data.find((x) => x.teamId === t.id);
          return (
            <Fragment key={t.id}>
              {i > 0 && <Divider />}
              <ListItem
                icon="shield"
                title={t.name}
                subtitle={[t.city, t.state].filter(Boolean).join(', ') + (t.pool ? ` · Pool ${t.pool}` : '')}
                right={
                  f ? (
                    <Button
                      title="Unfollow"
                      variant="ghost"
                      small
                      onPress={async () => {
                        if (await confirmAction('Unfollow team?', `You'll stop getting alerts for ${t.name}.`, 'Unfollow')) {
                          await backend.remove('follows', [f.id]);
                        }
                      }}
                    />
                  ) : (
                    <Caption>Your player</Caption>
                  )
                }
              />
            </Fragment>
          );
        })}
      </Card>
    </Screen>
  );
}
