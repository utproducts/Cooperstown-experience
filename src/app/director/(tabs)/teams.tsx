import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Badge, Button, Caption, Card, Empty, Field, H1, H3, Row, Screen } from '@/components/ui';
import { C } from '@/constants/theme';
import { useDirectorData } from '@/data/director';
import { toCsv } from '@/lib/csv';
import { shareTextFile } from '@/lib/share-file';

export default function Teams() {
  const d = useDirectorData();
  const [q, setQ] = useState('');
  const teams = d.teams.filter((t) => `${t.name} ${t.city} ${t.state} ${t.code}`.toLowerCase().includes(q.toLowerCase()));

  function exportRegistrations() {
    const csv = toCsv(
      ['Team', 'Team Code', 'Pool', 'First Name', 'Last Name', 'Jersey', 'Birth Date', 'Parent Name', 'Parent Email', 'Parent Phone', 'Checked In At'],
      d.players.map((p) => {
        const t = d.teams.find((x) => x.id === p.teamId);
        return [t?.name, t?.code, t?.pool, p.firstName, p.lastName, p.jerseyNumber, p.birthDate, p.guardianName, p.guardianEmail, p.guardianPhone, p.checkedInAt];
      }),
    );
    shareTextFile(`registrations-${d.event?.startsOn ?? 'event'}.csv`, csv);
  }

  return (
    <Screen refreshing={d.loading} onRefresh={d.refresh}>
      <H1>Teams</H1>
      <Row style={{ flexWrap: 'wrap' }}>
        <Button title="Import registrations" icon="cloud-upload" small onPress={() => router.push('/director/import')} />
        <Button title="Export registrations" icon="download" variant="secondary" small onPress={exportRegistrations} disabled={!d.players.length} />
      </Row>
      <Field placeholder="Search teams" value={q} onChangeText={setQ} />
      {d.teams.length === 0 && (
        <Card>
          <Empty
            icon="people-outline"
            title="No teams yet"
            body="Import your LeagueApps registration export to create teams, team codes and player check-in passes."
            action={<Button title="Import registrations" onPress={() => router.push('/director/import')} />}
          />
        </Card>
      )}
      {teams.map((t) => {
        const roster = d.players.filter((p) => p.teamId === t.id);
        const inCount = roster.filter((p) => p.checkedInAt).length;
        const inv = d.invites.filter((i) => i.teamId === t.id);
        const sent = inv.filter((i) => i.sentAt).length;
        return (
          <Card key={t.id} onPress={() => router.push(`/director/team/${t.id}` as never)}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <H3>{t.name}</H3>
                <Caption>
                  {[t.city, t.state].filter(Boolean).join(', ')}
                  {t.coachName ? ` · ${t.coachName}` : ''}
                </Caption>
              </View>
              {t.pool && <Badge label={`Pool ${t.pool}`} />}
            </Row>
            <Row style={{ flexWrap: 'wrap' }}>
              <Badge label={t.code ?? '—'} tone="red" icon="key" />
              <Badge label={`${roster.length} players`} tone="muted" />
              <Badge label={`${inCount}/${roster.length} checked in`} tone={inCount === roster.length && roster.length ? 'green' : 'muted'} />
              <Badge label={`${sent}/${inv.length} invites sent`} tone={sent === inv.length ? 'green' : 'warn'} />
            </Row>
          </Card>
        );
      })}
      {d.teams.length > 0 && <Caption style={{ color: C.muted }}>Tap a team for its roster, follow code and invites.</Caption>}
    </Screen>
  );
}
