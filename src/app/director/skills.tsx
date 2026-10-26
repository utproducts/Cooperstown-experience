import { useState } from 'react';
import { View } from 'react-native';

import { Sheet } from '@/components/sheet';
import { Body, Button, Caption, Card, Divider, ErrorNote, Field, H1, ListItem, Row, Screen, Segmented, confirmAction } from '@/components/ui';
import { useAuth, useTable } from '@/data';
import { useDirectorData } from '@/data/director';
import type { SkillsEvent } from '@/data/types';
import { rankResults } from '@/lib/venue';

/** Staff: the week's skills events and their results (public leaderboards show first name and last initial). */
export default function SkillsAdmin() {
  const { backend, profile } = useAuth();
  const d = useDirectorData();
  const eventId = d.event?.id ?? '__none__';
  const events = useTable('skills_events', { eq: { eventId }, order: { column: 'sort' } });
  const ids = events.data.map((e) => e.id);
  const results = useTable('skills_results', { in: { column: 'skillsEventId', values: ids.length ? ids : ['__none__'] } });
  const [picked, setPicked] = useState<string | null>(null);
  const current = events.data.find((e) => e.id === picked) ?? events.data[0];
  const [newEvent, setNewEvent] = useState(false);
  // Result entry
  const [q, setQ] = useState('');
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const player = d.players.find((p) => p.id === playerId);
  const matches = q.trim().length >= 2 ? d.players.filter((p) => `${p.firstName} ${p.lastName} ${p.jerseyNumber ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];
  const board = current ? rankResults(results.data.filter((r) => r.skillsEventId === current.id), current.better) : [];
  const teamName = (id: string | null) => d.teams.find((t) => t.id === id)?.name ?? '';

  return (
    <Screen refreshing={events.loading} onRefresh={() => (events.refresh(), results.refresh())}>
      <H1>Skills competition</H1>
      <Caption>{d.event?.name ?? 'This week'} · families see live leaderboards on the Park tab.</Caption>
      {events.data.length > 0 && <Segmented value={current!.id} onChange={setPicked} options={events.data.map((e) => ({ value: e.id, label: e.name }))} />}
      <Button title="Add an event" icon="add" small variant="secondary" disabled={!d.event} onPress={() => setNewEvent(true)} />
      {current && (
        <>
          <Card>
            <Body style={{ fontWeight: '800' }}>Enter a result: {current.name}</Body>
            <Field placeholder="Find a player (name or jersey #)" value={player ? `${player.firstName} ${player.lastName}` : q} onChangeText={(v) => (setQ(v), setPlayerId(null))} />
            {!player &&
              matches.map((p) => (
                <ListItem key={p.id} icon="person" title={`${p.firstName} ${p.lastName}${p.jerseyNumber ? ` #${p.jerseyNumber}` : ''}`} subtitle={teamName(p.teamId)} onPress={() => setPlayerId(p.id)} />
              ))}
            {d.players.length === 0 && <Caption>No rosters yet: import players or add them on a team’s page to enter results.</Caption>}
            <Field label={`Result (${current.unit || 'number'}, ${current.better === 'low' ? 'lower' : 'higher'} is better)`} value={value} onChangeText={setValue} keyboardType="decimal-pad" />
            <ErrorNote message={error} />
            <Button
              title="Save result"
              icon="checkmark"
              disabled={!player || !Number.isFinite(parseFloat(value))}
              onPress={async () => {
                setError(null);
                try {
                  await backend.insert('skills_results', [
                    {
                      skillsEventId: current.id,
                      teamId: player!.teamId,
                      playerId: player!.id,
                      displayName: `${player!.firstName} ${(player!.lastName[0] ?? '').toUpperCase()}${player!.lastName ? '.' : ''}`.trim(),
                      value: parseFloat(value),
                      recordedBy: profile?.name ?? '',
                    },
                  ]);
                  setValue('');
                  setQ('');
                  setPlayerId(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          </Card>
          <Card style={{ gap: 0 }}>
            <Body style={{ fontWeight: '800' }}>Leaderboard</Body>
            {board.length === 0 && <Caption>No results yet.</Caption>}
            {board.map((r, i) => (
              <View key={r.id}>
                {i > 0 && <Divider />}
                <Row style={{ paddingVertical: 8 }}>
                  <Body style={{ width: 28, fontWeight: '800' }}>{r.place}</Body>
                  <View style={{ flex: 1 }}>
                    <Body style={{ fontWeight: '700' }}>{r.displayName}</Body>
                    <Caption>{teamName(r.teamId)}</Caption>
                  </View>
                  <Body style={{ fontWeight: '800' }}>
                    {r.value} {current.unit}
                  </Body>
                  <Button
                    title="Remove"
                    small
                    variant="ghost"
                    onPress={async () => {
                      if (await confirmAction('Remove this result?', `${r.displayName}: ${r.value} ${current.unit}`, 'Remove')) backend.remove('skills_results', [r.id]);
                    }}
                  />
                </Row>
              </View>
            ))}
          </Card>
        </>
      )}
      {newEvent && d.event && <NewSkillsEvent eventId={d.event.id} sort={events.data.length} onClose={() => setNewEvent(false)} />}
    </Screen>
  );
}

function NewSkillsEvent({ eventId, sort, onClose }: { eventId: string; sort: number; onClose: () => void }) {
  const { backend } = useAuth();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [better, setBetter] = useState<SkillsEvent['better']>('high');
  const [description, setDescription] = useState('');
  return (
    <Sheet visible title="New skills event" onClose={onClose}>
      <Field label="Name" value={name} onChangeText={setName} placeholder="Around the Bases" />
      <Field label="Unit" value={unit} onChangeText={setUnit} placeholder="sec, mph, ft, HR" />
      <Segmented
        value={better}
        onChange={setBetter}
        options={[
          { value: 'high', label: 'Highest wins' },
          { value: 'low', label: 'Lowest wins (times)' },
        ]}
      />
      <Field label="Description" value={description} onChangeText={setDescription} />
      <Button
        title="Add event"
        disabled={!name.trim()}
        onPress={async () => {
          await backend.insert('skills_events', [{ eventId, name: name.trim(), unit: unit.trim(), better, description: description.trim(), startsAt: null, placeId: null, sort }]);
          onClose();
        }}
      />
    </Sheet>
  );
}
