import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { C, Fonts, R, S } from '@/constants/theme';
import { useBackend } from '@/data';
import { clearScore, delayGames, rescheduleGame, saveScore } from '@/data/services';
import type { EventWeek, Game, Team } from '@/data/types';
import { localDateKey, localTimeKey, zonedToIso, formatDateTime } from '@/lib/time';
import { TimeSelect } from './time-select';

import { teamLabel } from './game-card';
import { Sheet } from './sheet';
import { Body, Button, Caption, ErrorNote, Field, H3, Row, Segmented, confirmAction } from './ui';

type Mode = 'score' | 'time' | 'delay';

/** Director editor for a single game: score entry, reschedule, quick delay. */
export function GameEditor({
  game,
  event,
  teams,
  games,
  onClose,
}: {
  game: Game;
  event: EventWeek;
  teams: Team[];
  games: Game[];
  onClose: () => void;
}) {
  const backend = useBackend();
  // Parents render this with key={game.id}, so initial state comes straight from props.
  const [mode, setMode] = useState<Mode>('score');
  const [home, setHome] = useState(game.homeScore?.toString() ?? '');
  const [away, setAway] = useState(game.awayScore?.toString() ?? '');
  const [balls, setBalls] = useState(game.baseballsUsed?.toString() ?? '');
  const [date, setDate] = useState(() => localDateKey(game.startsAt, event.timezone));
  const [time, setTime] = useState(() => localTimeKey(game.startsAt, event.timezone));
  const [field, setField] = useState(game.field);
  const [reason, setReason] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [cascade, setCascade] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const homeName = teamLabel(teams, game.homeTeamId, game.homeLabel);
  const awayName = teamLabel(teams, game.awayTeamId, game.awayLabel);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const parsed = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.min(500, parseInt(v, 10) || 0)));
  const scoreRow = (name: string, value: string, set: (v: string) => void) => (
    <Row style={{ justifyContent: 'space-between' }}>
      <Text numberOfLines={1} style={styles.teamName}>
        {name}
      </Text>
      <Row gap={6}>
        <Button title="−" variant="secondary" small onPress={() => set(String(Math.max(0, (parseInt(value, 10) || 0) - 1)))} />
        <TextInput value={value} onChangeText={(t) => set(t.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" style={styles.scoreInput} placeholder="–" />
        <Button title="+" variant="secondary" small onPress={() => set(String((parseInt(value, 10) || 0) + 1))} />
      </Row>
    </Row>
  );

  return (
    <Sheet visible title={`G${game.number} · ${game.field}`} onClose={onClose}>
      <Caption>
        {formatDateTime(game.startsAt, event.timezone)}
        {game.round ? ` · ${game.round}` : ''}
      </Caption>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'score', label: 'Score' },
          { value: 'delay', label: 'Delay' },
          { value: 'time', label: 'Reschedule' },
        ]}
      />

      {mode === 'score' && (
        <>
          {scoreRow(awayName, away, setAway)}
          {scoreRow(homeName, home, setHome)}
          {scoreRow('Baseballs used', balls, setBalls)}
          <Row style={{ flexWrap: 'wrap' }}>
            {backend.features.liveStatus && (
            <Button
              title="Save as live"
              variant="secondary"
              loading={busy}
              onPress={() => run(() => saveScore(backend, game, teams, parsed(home) ?? 0, parsed(away) ?? 0, 'live', parsed(balls)))}
              style={{ flexGrow: 1 }}
            />
            )}
            <Button
              title="Final"
              icon="flag"
              loading={busy}
              disabled={parsed(home) === null || parsed(away) === null || (game.stage === 'bracket' && parsed(home) === parsed(away))}
              onPress={() => run(() => saveScore(backend, game, teams, parsed(home), parsed(away), 'final', parsed(balls)))}
              style={{ flexGrow: 1 }}
            />
          </Row>
          <Caption>
            {backend.features.alerts ? 'Marking final notifies both teams' : 'Marking final posts the score'}
            {game.stage === 'bracket' ? ' and advances the winner' : ''}.
          </Caption>
          {(game.homeScore !== null || game.status === 'final') && (
            <Button
              title="Remove score"
              variant="danger"
              small
              onPress={async () => {
                if (await confirmAction('Remove score?', 'The game goes back to scheduled.', 'Remove')) run(() => clearScore(backend, game));
              }}
            />
          )}
          <Row>
            {backend.features.liveStatus && (
              <Button title="Postpone" variant="ghost" small onPress={() => run(() => backend.update('games', game.id, { status: 'postponed' }))} />
            )}
            <Button title="Cancel game" variant="ghost" small onPress={() => run(() => backend.update('games', game.id, { status: 'cancelled' }))} />
          </Row>
        </>
      )}

      {mode === 'delay' && (
        <>
          <Body>
            Push this game back{cascade ? ', along with every later game on this field today' : ''}.{' '}
            {backend.features.alerts ? 'Both teams get a push notification.' : 'Families see the new time on the schedule.'}
          </Body>
          <Row style={{ flexWrap: 'wrap' }}>
            {[15, 30, 45, 60, 90, 120].map((m) => (
              <Button key={m} title={`${m} min`} small variant={minutes === m ? 'dark' : 'secondary'} onPress={() => setMinutes(m)} />
            ))}
          </Row>
          <Row>
            <Button title={cascade ? '✓ Shift later games on this field' : 'Only this game'} small variant="secondary" onPress={() => setCascade(!cascade)} />
          </Row>
          <Field label="Reason (sent to families)" placeholder="Lightning in the area" value={reason} onChangeText={setReason} />
          <Button
            title={`Delay ${minutes} minutes`}
            icon="time"
            loading={busy}
            onPress={() => run(async () => void (await delayGames(backend, event, games, teams, [game.id], minutes, { cascade, reason })))}
          />
        </>
      )}

      {mode === 'time' && (
        <>
          <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} autoCapitalize="none" />
          <TimeSelect label="Start time" value={time} onChange={setTime} step={15} max="23:45" timeZone={event.timezone} />
          <Field label="Field" value={field} onChangeText={setField} />
          <Field label="Note to families (optional)" value={reason} onChangeText={setReason} />
          <Button
            title="Save & notify teams"
            loading={busy}
            disabled={!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time) || !field.trim()}
            onPress={() => run(() => rescheduleGame(backend, event, game, teams, { startsAt: zonedToIso(date, time, event.timezone), field: field.trim() }, reason))}
          />
          <Button
            title="Delete game"
            variant="danger"
            small
            onPress={async () => {
              if (await confirmAction('Delete game?', `G${game.number}: ${awayName} at ${homeName}`, 'Delete')) run(() => backend.remove('games', [game.id]));
            }}
          />
        </>
      )}
      <ErrorNote message={error} />
    </Sheet>
  );
}

export function GameEditorHint() {
  return (
    <View style={styles.hint}>
      <H3 style={{ color: C.navy, fontSize: 14 }}>Tip</H3>
      <Caption>Tap any game to enter a score, delay it, or move it.</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  teamName: { flex: 1, fontSize: 16, fontWeight: '700', color: C.ink, marginRight: S.sm },
  scoreInput: {
    width: 56,
    height: 44,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    fontFamily: Fonts.display,
    color: C.ink,
  },
  hint: { backgroundColor: C.goldSoft, padding: S.md, borderRadius: R.md, gap: 2 },
});
