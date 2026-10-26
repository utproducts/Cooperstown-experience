import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Body, Button, Caption, Card, Divider, ErrorNote, Field, H1, H2, H3, Row, Screen, Stack, confirmAction, showMessage } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { useBackend, useLiveQuery } from '@/data';
import { useDirectorData } from '@/data/director';
import { planEventWeek, postWeekSchedule, seedBrackets, type WeekBuildSettings } from '@/data/services';
import { fieldNames } from '@/lib/schedule';
import { dateRange, formatDay } from '@/lib/time';
import { planSummary } from '@/lib/week-schedule';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;
const to12h = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h % 24 < 12 ? 'AM' : 'PM'}`;
};
const when = (dateTime: string) => {
  const [date, time] = dateTime.split(' ');
  return `${formatDay(date)} ${to12h(time)}`;
};

interface DayRow {
  start: string;
  end: string;
  pool: boolean;
  bracket: boolean;
}

/** Cooperstown's week: pool play Days 1–4, brackets from Day 4 (one slot after the last pool game) to the end. */
function defaultDays(count: number): DayRow[] {
  return Array.from({ length: count }, (_, i) => ({ start: '08:00', end: '22:00', pool: i <= count - 3, bracket: i >= count - 3 }));
}

interface SavedSettings {
  days?: DayRow[];
  slotMinutes?: number;
  poolGames?: number;
  maxPerDay?: number;
  bracketMaxPerDay?: number;
  restSlots?: number;
  brackets?: string[];
}

export default function Builder() {
  const d = useDirectorData();
  // Start from the week's saved settings; switching weeks starts fresh.
  return <BuilderForWeek key={d.event?.id ?? 'none'} />;
}

function BuilderForWeek() {
  const backend = useBackend();
  const d = useDirectorData();
  const event = d.event;
  const dates = event ? dateRange(event.startsOn, event.endsOn) : [];
  const saved = (event?.settings ?? {}) as SavedSettings;
  const weekFields = useLiveQuery(`fields:${event?.id}`, ['events'], async (b) => (event && b.weekFields ? b.weekFields(event.id) : null), null as string[] | null);

  const [fieldCount, setFieldCount] = useState('12');
  const [slotMinutes, setSlotMinutes] = useState(String(saved.slotMinutes ?? 120));
  const [poolGames, setPoolGames] = useState(String(saved.poolGames ?? 6));
  const [maxPerDay, setMaxPerDay] = useState(String(saved.maxPerDay ?? 3));
  const [bracketMaxPerDay, setBracketMaxPerDay] = useState(String(saved.bracketMaxPerDay ?? 4));
  const [restSlots, setRestSlots] = useState(String(saved.restSlots ?? 1));
  const [bracketNames, setBracketNames] = useState((saved.brackets ?? ['Championship', 'Monster', 'Cooper']).join(', '));
  const [daysState, setDays] = useState<DayRow[] | null>(saved.days?.length ? saved.days.map((x) => ({ start: x.start, end: x.end, pool: !!x.pool, bracket: !!x.bracket })) : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const days = daysState && daysState.length === dates.length ? daysState : defaultDays(dates.length);
  const setDay = (i: number, patch: Partial<DayRow>) => setDays(days.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const num = (v: string, lo: number, hi: number, fallback: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= lo && n <= hi ? n : fallback;
  };
  const settings: WeekBuildSettings = {
    // A week's own fields when the database keeps them (Cooperstown), otherwise "Field 1"…"Field n".
    fields: weekFields.data?.length ? weekFields.data : fieldNames(num(fieldCount, 1, 40, 12)),
    days: dates.map((date, i) => ({ date, ...days[i] })),
    slotMinutes: num(slotMinutes, 30, 300, 120),
    poolGames: num(poolGames, 1, 12, 6),
    maxPerDay: num(maxPerDay, 1, 6, 3),
    bracketMaxPerDay: num(bracketMaxPerDay, 1, 6, 4),
    restSlots: num(restSlots, 0, 4, 1),
    brackets: bracketNames
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean),
  };
  const invalid =
    !event ? 'Create the season’s weeks first under More → Weeks.'
    : d.teams.length < 2 ? 'Import this week’s teams first.'
    : settings.days.some((x) => !TIME.test(x.start) || !TIME.test(x.end) || x.end <= x.start) ? 'Each day needs a first game and a later end time (24-hour, e.g. 08:00 and 22:00).'
    : !settings.days.some((x) => x.pool) ? 'Choose at least one pool play day.'
    : !settings.days.some((x) => x.bracket) ? 'Choose at least one bracket day.'
    : !settings.brackets?.length ? 'Name at least one bracket.'
    : null;
  const plan = invalid ? null : planEventWeek(d.teams, settings);
  const summary = plan ? planSummary(d.teams.map((t) => ({ id: t.id, name: t.name, club: t.organization ?? '', state: t.state })), plan, settings) : null;

  const posted = { pool: d.games.filter((g) => g.stage === 'pool'), bracket: d.games.filter((g) => g.stage === 'bracket') };
  const finalPool = posted.pool.filter((g) => g.status === 'final').length;
  const scored = d.games.filter((g) => g.homeScore !== null).length;
  const seedsWaiting = posted.bracket.filter((g) => (g.homeSeed && !g.homeTeamId) || (g.awaySeed && !g.awayTeamId)).length;
  const seedsFilled = posted.bracket.some((g) => g.homeSeed && g.homeTeamId);

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
        {event.name} · {formatDay(event.startsOn)} – {formatDay(event.endsOn)} · {d.teams.length} teams. Pool play sets the seeds; then every team goes into a
        single-elimination bracket.
      </Body>
      <ErrorNote message={error} />

      {(posted.pool.length > 0 || posted.bracket.length > 0) && (
        <Card style={{ borderColor: C.green }}>
          <H2 style={{ fontSize: 18 }}>Posted schedule</H2>
          <Row style={{ flexWrap: 'wrap' }}>
            <Badge label={`${posted.pool.length} pool games`} tone="navy" />
            <Badge label={`${posted.bracket.length} bracket games`} tone="navy" />
            <Badge label={`${finalPool}/${posted.pool.length} pool games final`} tone={finalPool === posted.pool.length && posted.pool.length ? 'green' : 'muted'} />
          </Row>
          {posted.bracket.length > 0 && (
            <>
              <Body>
                {seedsWaiting === 0 && seedsFilled
                  ? 'Brackets are seeded. Winners move on automatically as scores come in.'
                  : `Bracket games show “Seed #N” until you seed them from the pool play standings.`}
              </Body>
              {posted.pool.length - finalPool > 0 && (
                <Caption>Seeding opens when every pool game has a final score ({posted.pool.length - finalPool} to go).</Caption>
              )}
              <Button
                title={seedsFilled ? 'Re-seed brackets from standings' : 'Seed brackets from pool play'}
                disabled={posted.pool.length - finalPool > 0 || posted.bracket.some((g) => g.status === 'final')}
                icon="git-network"
                variant="dark"
                loading={busy === 'seed'}
                onPress={async () => {
                  const msg = backend.features.alerts ? 'Every team will be told which bracket they’re in.' : 'Each team’s bracket games will show on the schedule.';
                  if (!(await confirmAction('Seed the brackets?', msg, 'Seed brackets'))) return;
                  run('seed', async () => {
                    const r = await seedBrackets(backend, event, d.teams, d.games);
                    showMessage('Brackets seeded', `${r.seeded} teams placed into their bracket games.`);
                  });
                }}
              />
            </>
          )}
        </Card>
      )}

      <Card>
        <H2 style={{ fontSize: 18 }}>Format</H2>
        <Row>
          <View style={{ flex: 1 }}>
            {weekFields.data?.length ? (
              <Field label="Fields (this week’s)" value={`${weekFields.data.length}: ${weekFields.data[0]} – ${weekFields.data.at(-1)}`} editable={false} />
            ) : (
              <Field label="Fields" value={fieldCount} onChangeText={setFieldCount} keyboardType="number-pad" />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Game slot (min)" value={slotMinutes} onChangeText={setSlotMinutes} keyboardType="number-pad" />
          </View>
        </Row>
        <Row>
          <View style={{ flex: 1 }}>
            <Field label="Pool games per team" value={poolGames} onChangeText={setPoolGames} keyboardType="number-pad" hint={`+ at least 1 bracket game = ${settings.poolGames + 1} minimum`} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Rest between games (slots)" value={restSlots} onChangeText={setRestSlots} keyboardType="number-pad" />
          </View>
        </Row>
        <Row>
          <View style={{ flex: 1 }}>
            <Field label="Max games a day" value={maxPerDay} onChangeText={setMaxPerDay} keyboardType="number-pad" hint="Includes a team’s first bracket game" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Max a day, team still winning" value={bracketMaxPerDay} onChangeText={setBracketMaxPerDay} keyboardType="number-pad" />
          </View>
        </Row>
        <Field label="Brackets, best pool records first" value={bracketNames} onChangeText={setBracketNames} hint="Every team advances; seeds split as evenly as possible, top seeds get byes." />
      </Card>

      <Card>
        <H2 style={{ fontSize: 18 }}>Days</H2>
        <Caption>Bracket games start one slot after the last pool game, so the last pool day can also be a bracket day.</Caption>
        {dates.map((date, i) => (
          <View key={date} style={styles.dayRow}>
            <View style={{ minWidth: 110 }}>
              <Body style={{ fontWeight: '700' }}>Day {i + 1}</Body>
              <Caption>{formatDay(date)}</Caption>
            </View>
            <Row gap={6}>
              <Button title="Pool" small variant={days[i].pool ? 'dark' : 'secondary'} onPress={() => setDay(i, { pool: !days[i].pool })} />
              <Button title="Bracket" small variant={days[i].bracket ? 'dark' : 'secondary'} onPress={() => setDay(i, { bracket: !days[i].bracket })} />
            </Row>
            <Row gap={6} style={{ flex: 1, minWidth: 180 }}>
              <View style={{ flex: 1 }}>
                <Field value={days[i].start} onChangeText={(v) => setDay(i, { start: v })} autoCapitalize="none" accessibilityLabel={`Day ${i + 1} first game`} />
              </View>
              <Caption>to</Caption>
              <View style={{ flex: 1 }}>
                <Field value={days[i].end} onChangeText={(v) => setDay(i, { end: v })} autoCapitalize="none" accessibilityLabel={`Day ${i + 1} last game ends`} />
              </View>
            </Row>
          </View>
        ))}
      </Card>

      <Card>
        <H2 style={{ fontSize: 18 }}>Plan</H2>
        {invalid && <Body style={{ color: C.warn }}>{invalid}</Body>}
        {plan && summary && (
          <Stack>
            {plan.problems.length > 0 ? (
              <View style={[styles.fit, { backgroundColor: C.warnSoft }]}>
                {plan.problems.map((p) => (
                  <Body key={p}>{p}</Body>
                ))}
              </View>
            ) : (
              <View style={[styles.fit, { backgroundColor: C.greenSoft }]}>
                <Body style={{ fontWeight: '700' }}>
                  {plan.games.length} games fit: {summary.poolGames} pool, {plan.games.length - summary.poolGames} bracket
                </Body>
              </View>
            )}
            <Row style={{ flexWrap: 'wrap' }}>
              <Badge label={`${summary.minPerTeam === summary.maxPerTeam ? summary.minPerTeam : `${summary.minPerTeam}–${summary.maxPerTeam}`} pool games each`} tone="navy" />
              <Badge label={`Max ${summary.maxGamesInADay} a day`} tone="navy" />
              <Badge label={`${summary.sameStateGames} same-state game${summary.sameStateGames === 1 ? '' : 's'}`} tone="navy" />
              <Badge label="Home/away balanced" tone="green" />
              <Badge label="No same-club games" tone="green" />
            </Row>
            <H3>Games per day</H3>
            {summary.perDay.map((day, i) => (
              <Row key={day.date} style={styles.tableRow}>
                <Text style={styles.cellDay}>
                  Day {i + 1} · {formatDay(day.date)}
                </Text>
                <Text style={styles.cellNum}>{day.games}</Text>
                <Caption style={{ flex: 1 }}>
                  {day.pool && day.games - day.pool ? `${day.pool} pool, ${day.games - day.pool} bracket` : day.pool ? 'Pool play' : day.games ? 'Bracket play' : '—'}
                </Caption>
              </Row>
            ))}
            <H3>Brackets</H3>
            {plan.brackets.map((b) => (
              <Row key={b.name} style={styles.tableRow}>
                <Text style={styles.cellDay}>{b.name}</Text>
                <Text style={styles.cellNum}>{b.teams}</Text>
                <Caption style={{ flex: 1 }}>
                  Seeds {b.seeds} · {b.byes} byes
                </Caption>
              </Row>
            ))}
            <H3>Bracket rounds</H3>
            {summary.bracketRounds.map((r) => (
              <Row key={r.label} style={styles.tableRow}>
                <Text style={[styles.cellDay, { minWidth: 190 }]}>{r.label}</Text>
                <Text style={styles.cellNum}>{r.games}</Text>
                <Caption style={{ flex: 1 }}>{r.from === r.to ? when(r.from) : `${when(r.from)} – ${when(r.to)}`}</Caption>
              </Row>
            ))}
            <Divider />
            {d.games.some((g) => g.status === 'final') && (
              <Caption>This week has scores, so the schedule can’t be rebuilt. Move or change games one at a time on the Games tab.</Caption>
            )}
            <Button
              title={posted.pool.length || posted.bracket.length ? 'Replace the posted schedule' : 'Post the week schedule'}
              icon="flash"
              loading={busy === 'post'}
              disabled={plan.problems.some((p) => !p.startsWith('An odd number')) || d.games.some((g) => g.status === 'final')}
              onPress={async () => {
                if (d.games.length) {
                  const msg = `This deletes the ${d.games.length} posted games${scored ? `, including ${scored} with scores` : ''}, and posts ${plan.games.length} new ones.`;
                  if (!(await confirmAction('Replace the schedule?', msg, 'Replace'))) return;
                }
                run('post', async () => {
                  const r = await postWeekSchedule(backend, event, plan);
                  // Keep the settings with the week (the check-in list and anything else stay as they were).
                  const { fields: _f, days: dayRows, ...rest } = settings;
                  await backend.update('events', event.id, {
                    settings: { ...(event.settings ?? {}), ...rest, days: dayRows.map(({ date: _d, ...x }) => x) },
                  });
                  showMessage('Schedule posted', `${r.pool} pool games and ${r.bracket} bracket games. Families and coaches can see them now.`);
                });
              }}
            />
          </Stack>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: S.md, paddingVertical: S.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },
  fit: { padding: S.md, borderRadius: R.md, gap: 4 },
  tableRow: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border, gap: S.md },
  cellDay: { minWidth: 140, fontWeight: '600', color: C.ink },
  cellNum: { width: 36, textAlign: 'right', fontWeight: '800', color: C.navy, fontVariant: ['tabular-nums'] },
});
