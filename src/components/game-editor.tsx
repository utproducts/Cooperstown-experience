import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { C, Fonts, R, S } from '@/constants/theme';
import { useBackend } from '@/data';
import { changeGameTeams, clearScore, delayGames, rescheduleGame, saveScore, swapGames } from '@/data/services';
import type { EventWeek, Game, Team } from '@/data/types';
import { DEFAULT_RULES, findConflicts, type Conflict, type ConflictRules } from '@/lib/game-conflicts';
import { dateRange, formatDay, formatTime, localDateKey, localTimeKey, zonedToIso, formatDateTime } from '@/lib/time';
import { TimeSelect } from './time-select';

import { teamLabel } from './game-card';
import { Sheet } from './sheet';
import { Body, Button, Caption, ErrorNote, Field, H3, Row, Segmented, confirmAction } from './ui';

type Mode = 'score' | 'time' | 'teams' | 'delay';

/** The week's own scheduling rules (saved by the schedule builder), for conflict checks. */
function weekRules(event: EventWeek): ConflictRules {
  const st = (event.settings ?? {}) as Partial<Record<'slotMinutes' | 'restSlots' | 'maxPerDay', number>>;
  return {
    slotMinutes: st.slotMinutes ?? DEFAULT_RULES.slotMinutes,
    restSlots: st.restSlots ?? DEFAULT_RULES.restSlots,
    maxPerDay: st.maxPerDay ?? DEFAULT_RULES.maxPerDay,
    timeZone: event.timezone,
  };
}

const byFieldNumber = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/** Director editor for a single game: score entry, move (with conflict checks), teams, quick delay. */
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
  const [homeId, setHomeId] = useState(game.homeTeamId);
  const [awayId, setAwayId] = useState(game.awayTeamId);
  const [picking, setPicking] = useState<'home' | 'away' | null>(null);
  const [teamQuery, setTeamQuery] = useState('');
  const rules = weekRules(event);
  const days = dateRange(event.startsOn, event.endsOn);
  const fields = [...new Set(games.map((g) => g.field))].sort(byFieldNumber);
  const nameOf = (id: string) => teams.find((t) => t.id === id)?.name ?? 'Team';
  const moveTo = /^\d{1,2}:\d{2}$/.test(time) ? zonedToIso(date, time, event.timezone) : game.startsAt;
  const moveConflicts = findConflicts(game, { startsAt: moveTo, field, homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId }, games, rules, nameOf);
  const teamConflicts = findConflicts(game, { startsAt: game.startsAt, field: game.field, homeTeamId: homeId, awayTeamId: awayId }, games, rules, nameOf).filter(
    (c) => c.kind !== 'field',
  );
  const moved = moveTo !== game.startsAt || field !== game.field;
  const teamsChanged = homeId !== game.homeTeamId || awayId !== game.awayTeamId;
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
          { value: 'time', label: 'Move' },
          { value: 'teams', label: 'Teams' },
          { value: 'delay', label: 'Delay' },
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
            {backend.features.push ? 'Both teams get a push notification.' : backend.features.alerts ? 'Both teams get an alert in the app.' : 'Families see the new time on the schedule.'}
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
          <Caption>Day</Caption>
          <Segmented value={date} onChange={setDate} options={days.map((x, i) => ({ value: x, label: `Day ${i + 1} · ${formatDay(x)}` }))} />
          <TimeSelect label="Start time" value={time} onChange={setTime} step={15} max="23:45" timeZone={event.timezone} />
          <Caption>Field</Caption>
          <Segmented value={field} onChange={setField} options={fields.map((f) => ({ value: f, label: f }))} />
          <ConflictList conflicts={moveConflicts} timeZone={event.timezone} teams={teams} onSwap={
            (other) => run(() => swapGames(backend, event, game, other, teams, reason))
          } busy={busy} />
          <Field label="Note to families (optional)" value={reason} onChangeText={setReason} />
          <Button
            title={!moved ? 'Pick a new day, time or field' : moveConflicts.length ? 'Move anyway & notify teams' : 'Move & notify teams'}
            icon="swap-horizontal"
            variant={moveConflicts.length ? 'danger' : 'primary'}
            loading={busy}
            disabled={!moved}
            onPress={async () => {
              if (moveConflicts.length && !(await confirmAction('Move anyway?', moveConflicts.map((c) => c.message).join('\n'), 'Move anyway'))) return;
              run(() => rescheduleGame(backend, event, game, teams, { startsAt: moveTo, field }, reason));
            }}
          />
          <Button
            title="Delete game"
            variant="ghost"
            small
            onPress={async () => {
              if (await confirmAction('Delete game?', `G${game.number}: ${awayName} at ${homeName}`, 'Delete')) run(() => backend.remove('games', [game.id]));
            }}
          />
        </>
      )}

      {mode === 'teams' && (
        <>
          {game.status === 'final' ? (
            <Caption>This game has a final score. Remove the score first to change who played.</Caption>
          ) : (
            <>
              {(['away', 'home'] as const).map((side) => {
                const id = side === 'home' ? homeId : awayId;
                const label = side === 'home' ? game.homeLabel : game.awayLabel;
                return (
                  <Row key={side} style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Caption>{side === 'home' ? 'Home' : 'Away'}</Caption>
                      <Body style={{ fontWeight: '700' }}>{id ? nameOf(id) : (label ?? 'To be decided')}</Body>
                    </View>
                    <Button title={picking === side ? 'Done' : 'Change'} small variant="secondary" onPress={() => (setPicking(picking === side ? null : side), setTeamQuery(''))} />
                  </Row>
                );
              })}
              <Button title="Swap home and away" icon="swap-vertical" small variant="secondary" onPress={() => (setHomeId(awayId), setAwayId(homeId))} />
              {picking && (
                <View style={{ gap: 6 }}>
                  <Field placeholder={`Find a team for ${picking}`} value={teamQuery} onChangeText={setTeamQuery} autoCorrect={false} />
                  <Row style={{ flexWrap: 'wrap' }} gap={6}>
                    {teams
                      .filter((t) => `${t.name} ${t.organization ?? ''} ${t.state}`.toLowerCase().includes(teamQuery.trim().toLowerCase()))
                      .slice(0, 40)
                      .map((t) => (
                        <Button
                          key={t.id}
                          title={t.name}
                          small
                          variant={(picking === 'home' ? homeId : awayId) === t.id ? 'dark' : 'secondary'}
                          onPress={() => (picking === 'home' ? setHomeId(t.id) : setAwayId(t.id), setPicking(null))}
                        />
                      ))}
                  </Row>
                </View>
              )}
              <ConflictList conflicts={teamConflicts} timeZone={event.timezone} teams={teams} busy={busy} />
              {game.stage === 'bracket' && <Caption>Bracket games are filled by seeding and winners. Change them only to fix a mistake.</Caption>}
              <Field label="Note to families (optional)" value={reason} onChangeText={setReason} />
              <Button
                title={teamConflicts.length ? 'Save anyway & notify teams' : 'Save & notify teams'}
                icon="people"
                variant={teamConflicts.length ? 'danger' : 'primary'}
                loading={busy}
                disabled={!teamsChanged || (!!homeId && homeId === awayId)}
                onPress={async () => {
                  if (teamConflicts.length && !(await confirmAction('Save anyway?', teamConflicts.map((c) => c.message).join('\n'), 'Save anyway'))) return;
                  run(() => changeGameTeams(backend, event, game, teams, { homeTeamId: homeId, awayTeamId: awayId }, reason));
                }}
              />
            </>
          )}
        </>
      )}
      <ErrorNote message={error} />
    </Sheet>
  );
}

/** What's wrong with a proposed move, each with the other game; a double-booked field can be fixed by swapping. */
function ConflictList({ conflicts, timeZone, teams, onSwap, busy }: { conflicts: Conflict[]; timeZone: string; teams: Team[]; onSwap?: (g: Game) => void; busy: boolean }) {
  if (!conflicts.length) return <Caption style={{ color: C.green, fontWeight: '700' }}>✓ No conflicts: the field is free and both teams are rested.</Caption>;
  return (
    <View style={styles.conflicts}>
      {conflicts.map((c, i) => (
        <View key={i} style={{ gap: 4 }}>
          <Body style={{ color: C.warn, fontWeight: '700' }}>⚠ {c.message}</Body>
          {c.game && (
            <Caption>
              G{c.game.number} · {formatTime(c.game.startsAt, timeZone)} · {c.game.field} · {teamLabel(teams, c.game.awayTeamId, c.game.awayLabel)} at {teamLabel(teams, c.game.homeTeamId, c.game.homeLabel)}
            </Caption>
          )}
          {c.kind === 'field' && c.game && onSwap && (
            <Button title={`Swap with G${c.game.number} instead`} icon="swap-horizontal" small variant="secondary" loading={busy} onPress={() => onSwap(c.game!)} />
          )}
        </View>
      ))}
    </View>
  );
}

export function GameEditorHint() {
  return (
    <View style={styles.hint}>
      <H3 style={{ color: C.navy, fontSize: 14 }}>Tip</H3>
      <Caption>Tap any game to enter a score, move it to another day, time or field, change its teams, or delay it. Moves are checked for double-booked fields and tired teams.</Caption>
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
  conflicts: { backgroundColor: C.warnSoft, padding: S.md, borderRadius: R.md, gap: S.sm },
});
