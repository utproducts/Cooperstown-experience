import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import { GameEditor, GameEditorHint } from '@/components/game-editor';
import { GamesByDay } from '@/components/schedule-views';
import { Sheet } from '@/components/sheet';
import { TimeSelect } from '@/components/time-select';
import { Badge, Body, Button, Caption, ErrorNote, Field, H1, Row, Screen, Segmented, showMessage } from '@/components/ui';
import { useBackend } from '@/data';
import { useDirectorData } from '@/data/director';
import { delayGames } from '@/data/services';
import type { Game } from '@/data/types';
import { toCsv } from '@/lib/csv';
import { shareTextFile } from '@/lib/share-file';
import { formatDay, localDateKey, localTimeKey } from '@/lib/time';

type Stage = 'all' | 'pool' | 'bracket' | 'open';

export default function DirectorGames() {
  const backend = useBackend();
  const d = useDirectorData();
  const [editing, setEditing] = useState<Game | null>(null);
  const [stage, setStage] = useState<Stage>('all');
  const [bulk, setBulk] = useState(false);
  const tz = d.event?.timezone;

  const games = useMemo(
    () =>
      d.games.filter((g) =>
        stage === 'all' ? true : stage === 'open' ? g.status !== 'final' && g.status !== 'cancelled' : g.stage === stage,
      ),
    [d.games, stage],
  );

  function exportCsv() {
    const name = (id: string | null, l: string | null) => d.teams.find((t) => t.id === id)?.name ?? l ?? '';
    const csv = toCsv(
      ['Game', 'Date', 'Time', 'Field', 'Stage', 'Bracket', 'Round', 'Away', 'Home', 'Away Score', 'Home Score', 'Status', 'Baseballs Used'],
      d.games.map((g) => [
        `G${g.number}`,
        localDateKey(g.startsAt, tz),
        localTimeKey(g.startsAt, tz),
        g.field,
        g.stage,
        g.bracket,
        g.round,
        name(g.awayTeamId, g.awayLabel),
        name(g.homeTeamId, g.homeLabel),
        g.awayScore,
        g.homeScore,
        g.status,
        g.baseballsUsed,
      ]),
    );
    shareTextFile(`schedule-${d.event?.startsOn ?? 'event'}.csv`, csv);
  }

  return (
    <Screen refreshing={d.loading} onRefresh={d.refresh}>
      <H1>Games</H1>
      <Row style={{ flexWrap: 'wrap' }}>
        <Button title="Build schedule" icon="construct" small onPress={() => router.push('/director/builder')} />
        <Button title="Delay a block" icon="time" variant="dark" small onPress={() => setBulk(true)} />
        <Button title="Export CSV" icon="download" variant="secondary" small onPress={exportCsv} />
      </Row>
      <GameEditorHint />
      <BaseballsSummary games={d.games} />
      <Segmented
        value={stage}
        onChange={setStage}
        options={[
          { value: 'all', label: 'All' },
          { value: 'open', label: 'Not final' },
          { value: 'pool', label: 'Pool play' },
          { value: 'bracket', label: 'Brackets' },
        ]}
      />
      <GamesByDay games={games} teams={d.teams} timeZone={tz} onPressGame={setEditing} emptyText="No games yet — use Build schedule." showBaseballs />
      {editing && d.event && <GameEditor key={editing.id} game={editing} event={d.event} teams={d.teams} games={d.games} onClose={() => setEditing(null)} />}
      {bulk && d.event && (
        <BulkDelay
          onClose={() => setBulk(false)}
          onApply={async (ids, minutes, reason) => {
            const res = await delayGames(backend, d.event!, d.games, d.teams, ids, minutes, { cascade: false, reason });
            showMessage('Delay sent', `${res.changes.length} games moved. ${res.affectedTeamIds.length} teams notified.`);
          }}
          games={d.games}
          timeZone={tz}
        />
      )}
    </Screen>
  );
}

function BulkDelay({
  games,
  timeZone,
  onClose,
  onApply,
}: {
  games: Game[];
  timeZone?: string;
  onClose: () => void;
  onApply: (ids: string[], minutes: number, reason: string) => Promise<void>;
}) {
  const today = localDateKey(new Date().toISOString(), timeZone);
  const days = [...new Set(games.map((g) => localDateKey(g.startsAt, timeZone)))].sort();
  const fields = [...new Set(games.map((g) => g.field))].sort();
  const [day, setDay] = useState(days.includes(today) ? today : days[0] ?? today);
  const [field, setField] = useState('all');
  // Now, rounded down to the quarter hour.
  const [from, setFrom] = useState(() => {
    const [h, m] = localTimeKey(new Date().toISOString(), timeZone).split(':').map(Number);
    return `${String(h).padStart(2, '0')}:${String(m - (m % 15)).padStart(2, '0')}`;
  });
  const [minutes, setMinutes] = useState(60);
  const [reason, setReason] = useState('Weather delay');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targets = games.filter(
    (g) =>
      localDateKey(g.startsAt, timeZone) === day &&
      (field === 'all' || g.field === field) &&
      localTimeKey(g.startsAt, timeZone) >= from.padStart(5, '0') &&
      g.status !== 'final' &&
      g.status !== 'cancelled',
  );
  const teams = new Set(targets.flatMap((g) => [g.homeTeamId, g.awayTeamId]).filter(Boolean));

  return (
    <Sheet visible title="Delay a block of games" onClose={onClose}>
      <Body>Push back every game that hasn’t finished in a window — e.g. a lightning hold. Every affected team gets its new times.</Body>
      <Caption>Day</Caption>
      <Segmented value={day} onChange={setDay} options={days.map((x) => ({ value: x, label: x === today ? 'Today' : formatDay(x) }))} />
      <Caption>Field</Caption>
      <Segmented value={field} onChange={setField} options={[{ value: 'all', label: 'All fields' }, ...fields.map((f) => ({ value: f, label: f }))]} />
      <TimeSelect label="Starting at or after" value={from} onChange={setFrom} step={15} max="23:45" timeZone={timeZone} />
      <Caption>Delay by</Caption>
      <Row style={{ flexWrap: 'wrap' }}>
        {[15, 30, 45, 60, 90, 120].map((m) => (
          <Button key={m} title={`${m} min`} small variant={minutes === m ? 'dark' : 'secondary'} onPress={() => setMinutes(m)} />
        ))}
      </Row>
      <Field label="Message to families" value={reason} onChangeText={setReason} />
      <Body style={{ fontWeight: '700' }}>
        {targets.length} games · {teams.size} teams will be notified
      </Body>
      <Button
        title={`Delay ${targets.length} games ${minutes} min`}
        icon="time"
        loading={busy}
        disabled={targets.length === 0}
        onPress={async () => {
          setBusy(true);
          setError(null);
          try {
            await onApply(
              targets.map((g) => g.id),
              minutes,
              reason,
            );
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <ErrorNote message={error} />
    </Sheet>
  );
}

function BaseballsSummary({ games }: { games: Game[] }) {
  const recorded = games.filter((g) => g.baseballsUsed !== null);
  if (recorded.length === 0) return null;
  const total = recorded.reduce((n, g) => n + (g.baseballsUsed ?? 0), 0);
  const finals = games.filter((g) => g.status === 'final').length;
  return (
    <Row style={{ flexWrap: 'wrap' }}>
      <Badge label={`${total} baseballs used`} tone="navy" icon="baseball" />
      <Badge label={`avg ${(total / recorded.length).toFixed(1)} a game`} tone="muted" />
      {finals > recorded.length && <Badge label={`${finals - recorded.length} final games missing a count`} tone="warn" />}
    </Row>
  );
}
