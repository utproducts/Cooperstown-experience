import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Badge, Body, Button, Caption, Card, Divider, ErrorNote, Field, H1, H2, H3, Row, Screen, Segmented, Stack, confirmAction, showMessage } from '@/components/ui';
import { C, S } from '@/constants/theme';
import { useBackend } from '@/data';
import { useDirectorData } from '@/data/director';
import { generateBracket, generatePoolPlay, setPools } from '@/data/services';
import { buildPoolMatchups, computeStandings, overallSeeds, placeMatchups } from '@/lib/schedule';
import { dateRange, formatDay, zonedToIso } from '@/lib/time';

const splitList = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

export default function Builder() {
  const backend = useBackend();
  const d = useDirectorData();
  const event = d.event;
  const days = event ? dateRange(event.startsOn, event.endsOn) : [];

  // --- pools
  const [poolCount, setPoolCount] = useState('4');
  // --- pool play
  const [gamesPerTeam, setGamesPerTeam] = useState('4');
  const [playDaysState, setPlayDays] = useState<string[] | null>(null);
  const [times, setTimes] = useState('08:00, 10:15, 12:30, 14:45, 17:00, 19:15');
  const [fields, setFields] = useState('Field 1, Field 2, Field 3, Field 4');
  const [minGap, setMinGap] = useState('240');
  const [maxPerDay, setMaxPerDay] = useState('2');
  // --- bracket
  const [advance, setAdvance] = useState('8');
  const [bracketDayState, setBracketDay] = useState<string | null>(null);
  const [bracketTimes, setBracketTimes] = useState('09:00, 12:00, 15:00, 18:00');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Defaults until the director picks: days 2-4 for pool play, the third-to-last day for the bracket.
  const playDays = playDaysState ?? days.slice(1, 4);
  const bracketDay = bracketDayState ?? days[Math.max(0, days.length - 3)] ?? '';

  const pooled = d.teams.filter((t) => t.pool);
  const pools = [...new Set(d.teams.map((t) => t.pool ?? '—'))].sort();
  const poolGames = d.games.filter((g) => g.stage === 'pool');
  const bracketGames = d.games.filter((g) => g.stage === 'bracket');

  const grid = { days: [...playDays].sort(), times: splitList(times), fields: splitList(fields) };
  const opts = { minGapMinutes: Number(minGap) || 0, maxGamesPerTeamPerDay: Number(maxPerDay) || 1 };
  const preview = useMemo(() => {
    if (!event || d.teams.length < 2) return null;
    const matchups = buildPoolMatchups(d.teams, Number(gamesPerTeam) || 1);
    const res = placeMatchups(matchups, { ...grid, timeZone: event.timezone }, opts);
    return { total: matchups.length, placed: res.scheduled.length, slots: grid.days.length * grid.times.length * grid.fields.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, d.teams, gamesPerTeam, playDays, times, fields, minGap, maxPerDay]);

  const standings = computeStandings(d.teams, d.games);
  const seeds = overallSeeds(standings).slice(0, Math.max(2, Math.min(d.teams.length, Number(advance) || d.teams.length)));
  const unfinishedPool = poolGames.filter((g) => g.status !== 'final' && g.status !== 'cancelled').length;

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
        <Body>Create an event first under More → Event settings.</Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <H1>Schedule builder</H1>
        <Button title="Done" variant="ghost" small onPress={() => router.push('/director/schedule')} />
      </Row>
      <Body style={{ color: C.muted }}>Three steps: split teams into pools, generate round-robin pool play, then seed the bracket from standings.</Body>
      <ErrorNote message={error} />

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H2>1 · Pools</H2>
          <Badge label={`${pooled.length}/${d.teams.length} assigned`} tone={pooled.length === d.teams.length && d.teams.length ? 'green' : 'muted'} />
        </Row>
        <Row>
          <View style={{ flex: 1 }}>
            <Field label="Number of pools" value={poolCount} onChangeText={setPoolCount} keyboardType="number-pad" />
          </View>
          <Button
            title="Auto-assign"
            style={{ alignSelf: 'flex-end' }}
            loading={busy === 'pools'}
            disabled={d.teams.length === 0}
            onPress={() => run('pools', () => setPools(backend, d.teams, Math.max(1, Number(poolCount) || 1)))}
          />
        </Row>
        <Caption>Teams are spread evenly (snake order). Tap a pool letter on a team to move it.</Caption>
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
                  <Row gap={4}>
                    {Array.from({ length: Math.max(1, Number(poolCount) || 1) }, (_, i) => String.fromCharCode(65 + i)).map((letter) => (
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
          <H2>2 · Pool play</H2>
          {poolGames.length > 0 && <Badge label={`${poolGames.length} games posted`} tone="green" />}
        </Row>
        <Field label="Games per team" value={gamesPerTeam} onChangeText={setGamesPerTeam} keyboardType="number-pad" />
        <Caption>Play days</Caption>
        <Row style={{ flexWrap: 'wrap' }}>
          {days.map((day) => (
            <Button
              key={day}
              title={formatDay(day)}
              small
              variant={playDays.includes(day) ? 'dark' : 'secondary'}
              onPress={() => setPlayDays(playDays.includes(day) ? playDays.filter((x) => x !== day) : [...playDays, day])}
            />
          ))}
        </Row>
        <Field label="Start times (24h, comma separated)" value={times} onChangeText={setTimes} autoCapitalize="none" />
        <Field label="Fields (comma separated)" value={fields} onChangeText={setFields} />
        <Row>
          <View style={{ flex: 1 }}>
            <Field label="Min. minutes between a team's games" value={minGap} onChangeText={setMinGap} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Max games per team per day" value={maxPerDay} onChangeText={setMaxPerDay} keyboardType="number-pad" />
          </View>
        </Row>
        {preview && (
          <View style={{ backgroundColor: preview.placed === preview.total ? C.greenSoft : C.warnSoft, padding: S.md, borderRadius: 10 }}>
            <Body style={{ fontWeight: '700' }}>
              {preview.placed} of {preview.total} games fit in {preview.slots} slots
            </Body>
            {preview.placed < preview.total && <Caption>Add days, times or fields, or reduce games per team.</Caption>}
          </View>
        )}
        <Button
          title={poolGames.length ? 'Regenerate pool play' : 'Generate pool play'}
          icon="flash"
          loading={busy === 'pool'}
          disabled={!preview || pooled.length !== d.teams.length || grid.days.length === 0}
          onPress={async () => {
            if (poolGames.length && !(await confirmAction('Replace pool play?', `This deletes ${poolGames.length} existing pool games (and their scores).`, 'Replace'))) return;
            run('pool', async () => {
              const r = await generatePoolPlay(backend, event, d.teams, Number(gamesPerTeam) || 1, grid, opts, { replaceExisting: true });
              showMessage('Pool play posted', `${r.created} games scheduled${r.unscheduled ? `, ${r.unscheduled} could not fit` : ''}. Families can see it now.`);
            });
          }}
        />
        {pooled.length !== d.teams.length && <Caption>Assign every team to a pool first.</Caption>}
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H2>3 · Bracket</H2>
          {bracketGames.length > 0 && <Badge label={`${bracketGames.length} games posted`} tone="green" />}
        </Row>
        {unfinishedPool > 0 && <Badge label={`${unfinishedPool} pool games not final yet`} tone="warn" icon="alert-circle" />}
        <Field label="Teams advancing" value={advance} onChangeText={setAdvance} keyboardType="number-pad" />
        <Caption>Bracket day</Caption>
        <Segmented value={bracketDay} onChange={setBracketDay} options={days.map((x) => ({ value: x, label: formatDay(x) }))} />
        <Field label="Round start times (one per round)" value={bracketTimes} onChangeText={setBracketTimes} autoCapitalize="none" />
        <Caption>Seeds from current standings:</Caption>
        <Stack gap={2}>
          {seeds.map((id, i) => {
            const row = standings.find((r) => r.teamId === id);
            return (
              <Row key={id}>
                <Badge label={`#${i + 1}`} tone={i < 4 ? 'red' : 'navy'} />
                <Body style={{ flex: 1 }} numberOfLines={1}>
                  {d.teams.find((t) => t.id === id)?.name}
                </Body>
                <Caption>
                  {row?.wins}-{row?.losses}
                  {row?.ties ? `-${row.ties}` : ''} · {row && row.runDiff > 0 ? '+' : ''}
                  {row?.runDiff}
                </Caption>
              </Row>
            );
          })}
        </Stack>
        <Divider />
        <Button
          title={bracketGames.length ? 'Rebuild bracket' : 'Build bracket'}
          icon="git-network"
          loading={busy === 'bracket'}
          disabled={seeds.length < 2 || !bracketDay}
          onPress={async () => {
            const msg = `${unfinishedPool ? `${unfinishedPool} pool games aren't final — seeds may change. ` : ''}${bracketGames.length ? `Existing bracket (${bracketGames.length} games) will be replaced. ` : ''}All seeded teams will be notified.`;
            if (!(await confirmAction('Post bracket?', msg, 'Post bracket'))) return;
            run('bracket', async () => {
              const starts = splitList(bracketTimes).map((t) => zonedToIso(bracketDay, t, event.timezone));
              const n = await generateBracket(backend, event, seeds, starts, splitList(fields));
              showMessage('Bracket posted', `${n} games created.`);
            });
          }}
        />
      </Card>
    </Screen>
  );
}
