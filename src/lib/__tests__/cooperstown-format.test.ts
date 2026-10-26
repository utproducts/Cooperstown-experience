import { describe, expect, it } from 'vitest';
import type { Game } from '../../data/types';
import {
  assignPools,
  buildBracket,
  buildPoolMatchups,
  dailySlots,
  fieldNames,
  placeMatchups,
  scheduleBrackets,
  splitIntoBrackets,
} from '../schedule';
import { localDateKey, localTimeKey } from '../time';
import { generateSeasonWeeks } from '../weeks';

const DAYS = ['2027-06-05', '2027-06-06', '2027-06-07', '2027-06-08', '2027-06-09', '2027-06-10'];
const FIELDS = fieldNames(12);
const TIMES = dailySlots('08:00', '22:00', 120);
const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`);

describe('Cooperstown format basics', () => {
  it('2-hour games from 8 AM, last game ending by 10 PM', () => {
    expect(TIMES).toEqual(['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00']);
    expect(dailySlots('22:00', '24:00', 120)).toEqual(['22:00']);
  });

  it('12 fields', () => {
    expect(FIELDS).toHaveLength(12);
    expect(FIELDS[11]).toBe('Field 12');
  });

  it('6-day rolling weeks with no break days', () => {
    const weeks = generateSeasonWeeks('2027-06-05', 3, { daysPerWeek: 6, breakDays: 0 });
    expect(weeks.map((w) => [w.startsOn, w.endsOn])).toEqual([
      ['2027-06-05', '2027-06-10'],
      ['2027-06-11', '2027-06-16'],
      ['2027-06-17', '2027-06-22'],
    ]);
  });

  it('splits seeds into Championship, Monster and Cooper tiers', () => {
    const b = splitIntoBrackets(ids(104), ['Championship', 'Monster', 'Cooper']);
    expect(b.map((x) => [x.name, x.teamIds.length])).toEqual([
      ['Championship', 35],
      ['Monster', 35],
      ['Cooper', 34],
    ]);
    expect(b[0].teamIds[0]).toBe('t1');
    expect(b[1].teamIds[0]).toBe('t36');
    expect(b[2].teamIds.at(-1)).toBe('t104');
  });
});

describe('a full 104-team week', () => {
  const teams = ids(104);
  const pools = assignPools(teams.map((id) => ({ id })), 13);
  const poolTeams = teams.map((id) => ({ id, pool: pools.get(id)! }));
  const matchups = buildPoolMatchups(poolTeams, 6);
  const pool = placeMatchups(matchups, { days: DAYS.slice(0, 4), times: TIMES, fields: FIELDS }, { minGapMinutes: 240, maxGamesPerTeamPerDay: 3 });
  const poolGames = pool.scheduled.map((m) => ({ startsAt: m.startsAt, field: m.field, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId }));

  it('fits 6 pool games per team into 4 days on 12 fields', () => {
    expect(matchups).toHaveLength(312);
    expect(pool.unscheduled).toHaveLength(0);
    const perTeam = new Map<string, number>();
    for (const g of pool.scheduled) for (const t of [g.homeTeamId, g.awayTeamId]) perTeam.set(t, (perTeam.get(t) ?? 0) + 1);
    expect([...perTeam.values()].every((n) => n === 6)).toBe(true);
    for (const g of pool.scheduled) {
      const t = localTimeKey(g.startsAt);
      expect(t >= '08:00' && t <= '20:00').toBe(true);
    }
  });

  it('runs every team into a bracket, all within the bracket days, no late games needed', () => {
    const seeds = teams; // pretend pool play seeded them in order
    const brackets = splitIntoBrackets(seeds, ['Championship', 'Monster', 'Cooper']).map((b) => ({ name: b.name, drafts: buildBracket(b.teamIds) }));
    const totalGames = brackets.reduce((n, b) => n + b.drafts.length, 0);
    expect(totalGames).toBe(104 - 3); // single elimination: one loss per team except each winner
    const res = scheduleBrackets(brackets, {
      days: DAYS.slice(4),
      times: TIMES,
      lateTimes: ['22:00'],
      fields: FIELDS,
      gameMinutes: 120,
      maxGamesPerTeamPerDay: 4,
      existing: poolGames,
    });
    expect(res.unscheduled).toHaveLength(0);
    expect(res.usedLate).toBe(false);
    assertBracketRules(res.placed);
  });
});

function assertBracketRules(placed: ReturnType<typeof scheduleBrackets>['placed']) {
  const byKey = new Map(placed.map((p) => [`${p.bracket}|${p.draft.key}`, p]));
  // fields never double-booked
  const slotField = placed.map((p) => `${p.startsAt}|${p.field}`);
  expect(new Set(slotField).size).toBe(slotField.length);
  for (const p of placed) {
    // the winner's next game starts after this one ends
    if (p.draft.winnerTo) {
      const next = byKey.get(`${p.bracket}|${p.draft.winnerTo.key}`)!;
      expect(new Date(next.startsAt).getTime() - new Date(p.startsAt).getTime()).toBeGreaterThanOrEqual(120 * 60000);
    }
  }
  // a team that keeps winning never plays more than 4 bracket games in a day: walk each path
  const feeders = new Map<string, string[]>();
  for (const p of placed) if (p.draft.winnerTo) {
    const k = `${p.bracket}|${p.draft.winnerTo.key}`;
    feeders.set(k, [...(feeders.get(k) ?? []), `${p.bracket}|${p.draft.key}`]);
  }
  const longest = (key: string, day: string): number => {
    const p = byKey.get(key)!;
    if (localDateKey(p.startsAt) !== day) return 0;
    return 1 + Math.max(0, ...(feeders.get(key) ?? []).map((f) => longest(f, day)));
  };
  for (const p of placed) expect(longest(`${p.bracket}|${p.draft.key}`, localDateKey(p.startsAt))).toBeLessThanOrEqual(4);
}

describe('scheduleBrackets', () => {
  const opts = { times: TIMES, lateTimes: ['22:00'], fields: FIELDS, gameMinutes: 120, maxGamesPerTeamPerDay: 4 };

  it('lets a team still winning play a 4th game in a day, never a 5th', () => {
    // 32-team bracket in one day: 5 rounds, so it can't all fit in one day with a cap of 4
    const brackets = [{ name: 'Championship', drafts: buildBracket(ids(32)) }];
    const oneDay = scheduleBrackets(brackets, { ...opts, days: [DAYS[4]] });
    expect(oneDay.unscheduled.map((u) => u.draft.roundName)).toEqual(['Final']);
    const twoDays = scheduleBrackets(brackets, { ...opts, days: DAYS.slice(4) });
    expect(twoDays.unscheduled).toHaveLength(0);
    const finalGame = twoDays.placed.find((p) => p.draft.roundName === 'Final')!;
    expect(localDateKey(finalGame.startsAt)).toBe(DAYS[5]);
    assertBracketRules(twoDays.placed);
  });

  it('uses late games only when the brackets would not finish otherwise', () => {
    // 3 fields, 16 teams in one day: 15 games, 7 regular slots x 3 fields = 21, but rounds are sequential
    const brackets = [{ name: 'Monster', drafts: buildBracket(ids(16)) }];
    const tight = scheduleBrackets(brackets, { ...opts, fields: fieldNames(1), days: [DAYS[4]], maxGamesPerTeamPerDay: 9 });
    // 1 field, 15 games, 7 regular + 1 late slot → still can't fit, but uses the late slot trying
    expect(tight.usedLate).toBe(true);
    const roomy = scheduleBrackets(brackets, { ...opts, days: [DAYS[4]] });
    expect(roomy.usedLate).toBe(false);
    expect(roomy.unscheduled).toHaveLength(0);
    const late = scheduleBrackets(brackets, { ...opts, fields: fieldNames(2), days: [DAYS[4]] });
    // 8 + 4 + 2 + 1 games; with 2 fields round 1 needs 4 slots (8–14), R2 2 slots (16–18), SF 20:00, Final needs 22:00
    expect(late.unscheduled).toHaveLength(0);
    expect(late.usedLate).toBe(true);
    expect(localTimeKey(late.placed.find((p) => p.draft.roundName === 'Final')!.startsAt)).toBe('22:00');
  });

  it('counts pool games already played that day toward the daily cap', () => {
    const brackets = [{ name: 'Cooper', drafts: buildBracket(['a', 'b']) }];
    const existing: Pick<Game, 'startsAt' | 'field' | 'homeTeamId' | 'awayTeamId'>[] = ['08:00', '12:00', '16:00', '20:00'].map((t, i) => ({
      startsAt: `${DAYS[4]}T${String(Number(t.slice(0, 2)) + 4).padStart(2, '0')}:00:00.000Z`,
      field: 'Field 1',
      homeTeamId: 'a',
      awayTeamId: `x${i}`,
    }));
    const res = scheduleBrackets(brackets, { ...opts, days: DAYS.slice(4) });
    const withPool = scheduleBrackets(brackets, { ...opts, days: DAYS.slice(4), existing });
    expect(localDateKey(res.placed[0].startsAt)).toBe(DAYS[4]);
    expect(localDateKey(withPool.placed[0].startsAt)).toBe(DAYS[5]);
  });
});
