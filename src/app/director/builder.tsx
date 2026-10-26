import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Badge, Body, Button, Caption, Card, Divider, ErrorNote, Field, H1, H2, H3, Row, Screen, Stack, confirmAction, showMessage } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { useBackend } from '@/data';
import { useDirectorData } from '@/data/director';
import { generateBrackets, generatePoolPlay, setPools } from '@/data/services';
import {
  buildBracket,
  buildPoolMatchups,
  computeStandings,
  dailySlots,
  fieldNames,
  overallSeeds,
  placeMatchups,
  scheduleBrackets,
  splitIntoBrackets,
} from '@/lib/schedule';
import { dateRange, formatDateTime, formatDay, formatTime } from '@/lib/time';

const splitList = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
const TIME = /^\d{1,2}:\d{2}$/;
const to12h = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h % 24 < 12 ? 'AM' : 'PM'}`;
};

/** Day chips: tap to include or exclude a day. */
function DayPicker({ days, selected, onChange }: { days: string[]; selected: string[]; onChange: (d: string[]) => void }) {
  return (
    <Row style={{ flexWrap: 'wrap' }} gap={6}>
      {days.map((day, i) => (
        <Button
          key={day}
          title={`Day ${i + 1} · ${formatDay(day)}`}
          small
          variant={selected.includes(day) ? 'dark' : 'secondary'}
          onPress={() => onChange(selected.includes(day) ? selected.filter((x) => x !== day) : [...selected, day].sort())}
        />
      ))}
    </Row>
  );
}

function Fit({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <View style={{ backgroundColor: ok ? C.greenSoft : C.warnSoft, padding: S.md, borderRadius: R.md, gap: 4 }}>{children}</View>;
}

export default function Builder() {
  const backend = useBackend();
  const d = useDirectorData();
  const event = d.event;
  const days = event ? dateRange(event.startsOn, event.endsOn) : [];

  // Cooperstown format
  const [fieldCount, setFieldCount] = useState('12');
  const [gameMinutes, setGameMinutes] = useState('120');
  const [dayStart, setDayStart] = useState('08:00');
  const [dayEnd, setDayEnd] = useState('22:00');
  // Pools
  const [poolSize, setPoolSize] = useState('8');
  // Pool play
  const [poolGames, setPoolGames] = useState('6');
  const [poolDaysState, setPoolDays] = useState<string[] | null>(null);
  const [poolMaxPerDay, setPoolMaxPerDay] = useState('3');
  const [restMinutes, setRestMinutes] = useState('120');
  // Brackets
  const [bracketNames, setBracketNames] = useState('Championship, Monster, Cooper');
  const [bracketDaysState, setBracketDays] = useState<string[] | null>(null);
  const [bracketMaxPerDay, setBracketMaxPerDay] = useState('4');
  const [lateUntil, setLateUntil] = useState('24:00');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Defaults until the director picks: pool play on the first four days, brackets on the last two.
  const poolDays = poolDaysState ?? days.slice(0, Math.max(1, days.length - 2));
  const bracketDays = bracketDaysState ?? days.slice(-2);

  const minutes = Math.max(30, Number(gameMinutes) || 120);
  const fields = fieldNames(Math.max(1, Number(fieldCount) || 1));
  const times = TIME.test(dayStart) && TIME.test(dayEnd) ? dailySlots(dayStart, dayEnd, minutes) : [];
  const lateTimes = TIME.test(lateUntil) ? dailySlots(dayEnd, lateUntil, minutes) : [];
  const names = splitList(bracketNames);
  const pooled = d.teams.filter((t) => t.pool);
  const pools = [...new Set(d.teams.map((t) => t.pool ?? '—'))].sort();
  const poolCount = Math.max(1, Math.round(d.teams.length / Math.max(2, Number(poolSize) || 8)));
  const existingPool = d.games.filter((g) => g.stage === 'pool');
  const existingBracket = d.games.filter((g) => g.stage === 'bracket');
  const gamesPerTeam = Math.max(1, Number(poolGames) || 1);
  const poolOpts = { minGapMinutes: minutes + Math.max(0, Number(restMinutes) || 0), maxGamesPerTeamPerDay: Math.max(1, Number(poolMaxPerDay) || 1) };

  const poolPreview = (() => {
    if (!event || d.teams.length < 2 || times.length === 0) return null;
    const matchups = buildPoolMatchups(d.teams, gamesPerTeam);
    const res = placeMatchups(matchups, { days: poolDays, times, fields, timeZone: event.timezone }, poolOpts);
    const last = res.scheduled.reduce((m, g) => (g.startsAt > m ? g.startsAt : m), '');
    return { total: matchups.length, placed: res.scheduled.length, capacity: poolDays.length * times.length * fields.length, last };
  })();

  const standings = computeStandings(d.teams, d.games);
  const seeds = overallSeeds(standings);
  const plans = splitIntoBrackets(seeds, names.length ? names : ['Championship']);
  const bracketSched = {
    days: bracketDays,
    times,
    lateTimes,
    fields,
    gameMinutes: minutes,
    maxGamesPerTeamPerDay: Math.max(1, Number(bracketMaxPerDay) || 1),
  };
  const bracketPreview = (() => {
    if (!event || seeds.length < 2 || times.length === 0) return null;
    const brackets = plans.filter((p) => p.teamIds.length >= 2).map((p) => ({ name: p.name, drafts: buildBracket(p.teamIds) }));
    const res = scheduleBrackets(brackets, { ...bracketSched, timeZone: event.timezone, existing: existingPool });
    const last = res.placed.reduce((m, g) => (g.startsAt > m ? g.startsAt : m), '');
    return { total: brackets.reduce((n, b) => n + b.drafts.length, 0), unscheduled: res.unscheduled.length, usedLate: res.usedLate, last };
  })();
  const unfinishedPool = existingPool.filter((g) => g.status !== 'final' && g.status !== 'cancelled').length;

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!event) {
    return (
      <Screen>
        <H1>Schedule builder</H1>
        <Body>Create the season’s weeks first under More → Weeks.</Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <H1>Schedule builder</H1>
        <Button title="Done" variant="ghost" small onPress={() => router.push('/director/schedule')} />
      </Row>
      <Body style={{ color: C.muted }}>
        {event.name} · {days.length}-day week · {d.teams.length} teams. Pool play sets the seeds, then every team advances to single-elimination bracket play.
      </Body>
      <ErrorNote message={error} />

      <Card>
        <H2 style={{ fontSize: 18 }}>Format</H2>
        <Row>
          <View style={{ flex: 1 }}>
            <Field label="Fields" value={fieldCount} onChangeText={setFieldCount} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Game length (min)" value={gameMinutes} onChangeText={setGameMinutes} keyboardType="number-pad" />
          </View>
        </Row>
        <Row>
          <View style={{ flex: 1 }}>
            <Field label="First game" value={dayStart} onChangeText={setDayStart} autoCapitalize="none" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Last game ends by" value={dayEnd} onChangeText={setDayEnd} autoCapitalize="none" />
          </View>
        </Row>
        <Caption>
          Start times: {times.map(to12h).join(', ') || '—'} · {times.length * fields.length} games a day across {fields.length} fields
        </Caption>
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H2 style={{ fontSize: 18 }}>1 · Pools</H2>
          <Badge label={`${pooled.length}/${d.teams.length} assigned`} tone={pooled.length === d.teams.length && d.teams.length ? 'green' : 'muted'} />
        </Row>
        <Row>
          <View style={{ flex: 1 }}>
            <Field label="Teams per pool" value={poolSize} onChangeText={setPoolSize} keyboardType="number-pad" hint={`${poolCount} pools for ${d.teams.length} teams`} />
          </View>
          <Button title="Auto-assign" style={{ alignSelf: 'center' }} loading={busy === 'pools'} disabled={d.teams.length === 0} onPress={() => run('pools', () => setPools(backend, d.teams, poolCount))} />
        </Row>
        <Caption>Teams are spread evenly (snake order). Tap a pool letter to move a team.</Caption>
        {pools.map((p) => (
          <Stack key={p} gap={4}>
            <H3>Pool {p}</H3>
            {d.teams
              .filter((t) => (t.pool ?? '—') === p)
              .map((t) => (
                <Row key={t.id} style={{ justifyContent: 'space-between' }}>
                  <Body style={{ flex: 1 }} numberOfLines={1}>
                    {t.name}
                  </Body>
                  <Row gap={4} style={{ flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '60%' }}>
                    {Array.from({ length: poolCount }, (_, i) => String.fromCharCode(65 + i)).map((letter) => (
                      <Button
                        key={letter}
                        title={letter}
                        small
                        variant={t.pool === letter ? 'dark' : 'secondary'}
                        onPress={() => backend.update('teams', t.id, { pool: letter })}
                        style={{ minWidth: 36, paddingHorizontal: 8 }}
                      />
                    ))}
                  </Row>
                </Row>
              ))}
          </Stack>
        ))}
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H2 style={{ fontSize: 18 }}>2 · Pool play (seeding)</H2>
          {existingPool.length > 0 && <Badge label={`${existingPool.length} games posted`} tone="green" />}
        </Row>
        <Field
          label="Pool games per team"
          value={poolGames}
          onChangeText={setPoolGames}
          keyboardType="number-pad"
          hint={`${gamesPerTeam} pool + at least 1 bracket game = ${gamesPerTeam + 1} games minimum per team`}
        />
        <Caption>Pool play days</Caption>
        <DayPicker days={days} selected={poolDays} onChange={setPoolDays} />
        <Row>
          <View style={{ flex: 1 }}>
            <Field label="Max games per team per day" value={poolMaxPerDay} onChangeText={setPoolMaxPerDay} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Min. rest between games (min)" value={restMinutes} onChangeText={setRestMinutes} keyboardType="number-pad" />
          </View>
        </Row>
        {poolPreview && (
          <Fit ok={poolPreview.placed === poolPreview.total}>
            <Body style={{ fontWeight: '700' }}>
              {poolPreview.placed} of {poolPreview.total} pool games fit ({poolPreview.capacity} slots)
            </Body>
            {poolPreview.placed === poolPreview.total && poolPreview.last && <Caption>Last pool game: {formatDateTime(poolPreview.last, event.timezone)}</Caption>}
            {poolPreview.placed < poolPreview.total && <Caption>Add a pool day, allow more games per day, or shorten the rest time.</Caption>}
          </Fit>
        )}
        <Button
          title={existingPool.length ? 'Regenerate pool play' : 'Generate pool play'}
          icon="flash"
          loading={busy === 'pool'}
          disabled={!poolPreview || poolPreview.placed < poolPreview.total || pooled.length !== d.teams.length}
          onPress={async () => {
            if (existingPool.length && !(await confirmAction('Replace pool play?', `This deletes ${existingPool.length} pool games (and their scores).`, 'Replace'))) return;
            run('pool', async () => {
              const r = await generatePoolPlay(backend, event, d.teams, gamesPerTeam, { days: poolDays, times, fields }, poolOpts, { replaceExisting: true });
              showMessage('Pool play posted', `${r.created} games scheduled. Families can see them now.`);
            });
          }}
        />
        {pooled.length !== d.teams.length && <Caption>Assign every team to a pool first.</Caption>}
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H2 style={{ fontSize: 18 }}>3 · Brackets (single elimination)</H2>
          {existingBracket.length > 0 && <Badge label={`${existingBracket.length} games posted`} tone="green" />}
        </Row>
        {unfinishedPool > 0 && <Badge label={`${unfinishedPool} pool games not final — seeds may still change`} tone="warn" icon="alert-circle" />}
        <Field label="Brackets, top seeds first" value={bracketNames} onChangeText={setBracketNames} hint="Every team advances. Seeds are split evenly, top tier first." />
        <Caption>Bracket days</Caption>
        <DayPicker days={days} selected={bracketDays} onChange={setBracketDays} />
        <Row>
          <View style={{ flex: 1 }}>
            <Field label="Max games per day (teams still winning)" value={bracketMaxPerDay} onChangeText={setBracketMaxPerDay} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Late games may run until" value={lateUntil} onChangeText={setLateUntil} autoCapitalize="none" hint="Used only if needed to finish" />
          </View>
        </Row>

        {plans.map((p) => (
          <View key={p.name} style={{ gap: 4 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <H3>{p.name}</H3>
              <Caption>{p.teamIds.length ? `Seeds ${seeds.indexOf(p.teamIds[0]) + 1}–${seeds.indexOf(p.teamIds.at(-1)!) + 1} · ${p.teamIds.length} teams · ${Math.max(0, p.teamIds.length - 1)} games` : 'No teams'}</Caption>
            </Row>
            <Caption numberOfLines={2}>
              {p.teamIds
                .slice(0, 6)
                .map((id) => `#${seeds.indexOf(id) + 1} ${d.teams.find((t) => t.id === id)?.name ?? ''}`)
                .join(' · ')}
              {p.teamIds.length > 6 ? ` · +${p.teamIds.length - 6} more` : ''}
            </Caption>
          </View>
        ))}
        {bracketPreview && (
          <Fit ok={bracketPreview.unscheduled === 0}>
            <Body style={{ fontWeight: '700' }}>
              {bracketPreview.total - bracketPreview.unscheduled} of {bracketPreview.total} bracket games fit
            </Body>
            {bracketPreview.unscheduled === 0 && bracketPreview.last && (
              <Caption>
                Last game (final): {formatDay(bracketPreview.last, event.timezone)} at {formatTime(bracketPreview.last, event.timezone)}
                {bracketPreview.usedLate ? ' · uses late games after ' + to12h(dayEnd) : ''}
              </Caption>
            )}
            {bracketPreview.unscheduled > 0 && <Caption>Add a bracket day, allow more games per day, or allow later games.</Caption>}
          </Fit>
        )}
        <Divider />
        <Button
          title={existingBracket.length ? 'Rebuild brackets' : 'Build brackets'}
          icon="git-network"
          loading={busy === 'bracket'}
          disabled={!bracketPreview || bracketPreview.unscheduled > 0}
          onPress={async () => {
            const msg = `${unfinishedPool ? `${unfinishedPool} pool games aren't final, so seeds may change. ` : ''}${existingBracket.length ? `The current brackets (${existingBracket.length} games) will be replaced. ` : ''}Every team will be told which bracket they're in.`;
            if (!(await confirmAction('Post brackets?', msg, 'Post brackets'))) return;
            run('bracket', async () => {
              const r = await generateBrackets(backend, event, plans, bracketSched);
              showMessage('Brackets posted', `${r.created} games across ${plans.filter((p) => p.teamIds.length >= 2).length} brackets.${r.usedLate ? ' Some games run late.' : ''}`);
            });
          }}
        />
      </Card>
    </Screen>
  );
}
