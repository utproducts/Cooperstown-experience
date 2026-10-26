import { Fragment, useState } from 'react';

import { Body, Button, Caption, Card, Divider, ErrorNote, Field, H1, H3, ListItem, Screen, Segmented, confirmAction } from '@/components/ui';
import { C } from '@/constants/theme';
import { useAuth, useTable } from '@/data';
import type { Tables } from '@/data/backend';
import { formatDay } from '@/lib/time';
import { pickDefaultEvent } from '@/lib/weeks';
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
      {!backend.features.followCodes && <FindTeam following={follows.data} />}
      {backend.features.followCodes && (
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
      )}
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

/** No invite codes: families pick their week, then their team. */
function FindTeam({ following }: { following: Tables['follows'][] }) {
  const { backend, profile } = useAuth();
  const events = useTable('events', { eq: { published: true }, order: { column: 'startsOn' } });
  const [picked, setPicked] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const weekId = picked ?? pickDefaultEvent(events.data, today)?.id ?? '__none__';
  const teams = useTable('teams', { eq: { eventId: weekId }, order: { column: 'name' } });
  const shown = teams.data.filter((t) => `${t.name} ${t.organization ?? ''} ${t.city} ${t.state}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Card>
      <H3>Find your team</H3>
      {events.data.length === 0 ? (
        <Caption>
          {events.error ? 'Couldn’t reach the schedule. Check your connection and pull down to try again.' : events.loading ? 'Loading weeks…' : 'No weeks are public yet. Check back soon.'}
        </Caption>
      ) : (
        <>
          <Segmented
            value={weekId}
            onChange={setPicked}
            options={events.data.map((e) => ({ value: e.id, label: `${e.name} · ${formatDay(e.startsOn)}` }))}
          />
          <Field placeholder="Search team, club or city" value={q} onChangeText={setQ} autoCorrect={false} />
          <Caption>{shown.length} teams</Caption>
          {shown.slice(0, 60).map((t, i) => {
            const f = following.find((x) => x.teamId === t.id);
            return (
              <Fragment key={t.id}>
                {i > 0 && <Divider />}
                <ListItem
                  icon="shield"
                  title={t.name}
                  subtitle={[t.city, t.state].filter(Boolean).join(', ')}
                  right={
                    <Button
                      title={f ? 'Following' : 'Follow'}
                      small
                      variant={f ? 'secondary' : 'dark'}
                      onPress={() => (f ? backend.remove('follows', [f.id]) : backend.insert('follows', [{ userId: profile?.id ?? 'guest', teamId: t.id }]))}
                    />
                  }
                />
              </Fragment>
            );
          })}
          {shown.length > 60 && <Caption>Showing 60 of {shown.length}. Search to narrow it down.</Caption>}
        </>
      )}
    </Card>
  );
}
