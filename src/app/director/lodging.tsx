import { useState } from 'react';
import { View } from 'react-native';

import { Sheet } from '@/components/sheet';
import { Badge, Body, Button, Caption, Card, Divider, Field, H1, ListItem, Row, Screen } from '@/components/ui';
import { useBackend, useTable } from '@/data';
import { useDirectorData } from '@/data/director';
import type { Team } from '@/data/types';
import { usePlaces } from '@/data/venue';

/**
 * Staff: which bunkhouse each team sleeps in this week, and any player staying somewhere else. Families see only
 * their own team's (Player tab).
 */
export default function LodgingAdmin() {
  const d = useDirectorData();
  const bunks = usePlaces('bunkhouse');
  const teamIds = d.teams.map((t) => t.id);
  const lodging = useTable('team_lodging', { in: { column: 'teamId', values: teamIds.length ? teamIds : ['__none__'] } });
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Team | null>(null);
  const byTeam = new Map(lodging.data.map((l) => [l.teamId, l]));
  const assigned = d.teams.filter((t) => byTeam.get(t.id)?.placeId).length;
  const shown = d.teams.filter((t) => `${t.name} ${t.organization ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const bunkName = (id: string | null | undefined) => bunks.data.find((b) => b.id === id)?.name;

  return (
    <Screen refreshing={lodging.loading} onRefresh={lodging.refresh}>
      <H1>Bunkhouses</H1>
      <Caption>
        {assigned} of {d.teams.length} teams assigned in {d.event?.name ?? 'this week'}. Add bunkhouses under Site map & places.
      </Caption>
      {bunks.data.length === 0 && <Badge label="No bunkhouses on the map yet" tone="warn" />}
      <Field placeholder="Search teams" value={q} onChangeText={setQ} />
      <Card style={{ gap: 0 }}>
        {shown.map((t, i) => {
          const l = byTeam.get(t.id);
          const splits = d.players.filter((p) => p.teamId === t.id && p.lodgingPlaceId).length;
          return (
            <View key={t.id}>
              {i > 0 && <Divider />}
              <ListItem
                icon="bed"
                iconColor={l?.placeId ? '#8B5E3C' : '#A0AEC0'}
                title={t.name}
                subtitle={[l?.placeId ? `${bunkName(l.placeId)}${l.room ? ` · ${l.room}` : ''}` : 'Not assigned', splits ? `${splits} player${splits === 1 ? '' : 's'} elsewhere` : ''].filter(Boolean).join(' · ')}
                onPress={() => setEditing(t)}
              />
            </View>
          );
        })}
      </Card>
      {editing && <TeamLodgingSheet key={editing.id} team={editing} lodging={byTeam.get(editing.id)} onClose={() => setEditing(null)} />}
    </Screen>
  );
}

function TeamLodgingSheet({ team, lodging, onClose }: { team: Team; lodging?: { placeId: string | null; room: string; notes: string }; onClose: () => void }) {
  const backend = useBackend();
  const d = useDirectorData();
  const bunks = usePlaces('bunkhouse');
  const roster = d.players.filter((p) => p.teamId === team.id);
  // Parents render this with key={team.id}, so initial state comes straight from props.
  const [placeId, setPlaceId] = useState<string | null>(lodging?.placeId ?? null);
  const [room, setRoom] = useState(lodging?.room ?? '');
  const [notes, setNotes] = useState(lodging?.notes ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet visible title={team.name} onClose={onClose}>
      <Caption>Team bunkhouse</Caption>
      <Row style={{ flexWrap: 'wrap' }} gap={6}>
        {bunks.data.map((b) => (
          <Button key={b.id} title={b.name} small variant={placeId === b.id ? 'dark' : 'secondary'} onPress={() => setPlaceId(b.id)} />
        ))}
      </Row>
      <Field label="Room / unit" value={room} onChangeText={setRoom} placeholder="e.g. A7" />
      <Field label="Notes (staff only)" value={notes} onChangeText={setNotes} />
      <Button
        title="Save team bunkhouse"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await backend.update('team_lodging', team.id, { teamId: team.id, placeId, room: room.trim(), notes: notes.trim() });
            onClose();
          } finally {
            setBusy(false);
          }
        }}
      />
      {roster.length > 0 && (
        <>
          <Divider />
          <Body style={{ fontWeight: '700' }}>Players staying somewhere else</Body>
          <Caption>Only for split teams. Everyone else stays with the team.</Caption>
          {roster.map((p) => (
            <Row key={p.id} style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <Body style={{ flex: 1 }}>
                {p.firstName} {p.lastName}
              </Body>
              <Row gap={6} style={{ flexWrap: 'wrap' }}>
                <Button title="With team" small variant={p.lodgingPlaceId ? 'secondary' : 'dark'} onPress={() => backend.update('players', p.id, { lodgingPlaceId: null, lodgingRoom: '' })} />
                {bunks.data
                  .filter((b) => b.id !== placeId)
                  .slice(0, 4)
                  .map((b) => (
                    <Button key={b.id} title={b.name.replace('Bunkhouse ', '')} small variant={p.lodgingPlaceId === b.id ? 'dark' : 'secondary'} onPress={() => backend.update('players', p.id, { lodgingPlaceId: b.id })} />
                  ))}
              </Row>
            </Row>
          ))}
        </>
      )}
    </Sheet>
  );
}
