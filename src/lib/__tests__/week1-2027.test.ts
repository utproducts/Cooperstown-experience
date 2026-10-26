import { describe, expect, it } from 'vitest';
import { WEEK1_2027_START, WEEK1_2027_TEAMS } from '../../data/week1-2027';
import { planSummary, planWeek, type WeekSettings } from '../week-schedule';
import { fieldNames } from '../schedule';
import { generateSeasonWeeks } from '../weeks';

// Cooperstown's defaults (utproducts/cooperstown lib/week.ts DEFAULT_SETTINGS) on the real Week 1 2027 field.
const days = generateSeasonWeeks(WEEK1_2027_START, 1)[0];
const dates = Array.from({ length: 6 }, (_, i) => {
  const d = new Date(`${days.startsOn}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString().slice(0, 10);
});
const settings: WeekSettings = {
  fields: fieldNames(12),
  days: dates.map((date, i) => ({ date, start: '08:00', end: '22:00', pool: i <= 3, bracket: i >= 3 })),
  slotMinutes: 120,
  poolGames: 6,
  maxPerDay: 3,
  bracketMaxPerDay: 4,
  restSlots: 1,
  brackets: ['Championship', 'Monster', 'Cooper'],
};
const teams = WEEK1_2027_TEAMS.map((t, i) => ({ id: `t${i + 1}`, name: t.name, club: t.organization, state: t.state }));
const plan = planWeek(teams, settings);
const summary = planSummary(teams, plan, settings);

describe('Week 1 2027 (100 real teams) matches the brief', () => {
  it('runs Sunday May 30 to Friday June 4', () => {
    expect(days).toMatchObject({ startsOn: '2027-05-30', endsOn: '2027-06-04' });
  });

  it('397 games: 300 pool and 97 bracket, with no problems', () => {
    expect(plan.problems).toEqual([]);
    expect(summary.poolGames).toBe(300);
    expect(plan.games.filter((g) => g.stage === 'bracket')).toHaveLength(97);
  });

  it('6 pool games for every team, at most 3 a day, exactly 3 home and 3 away', () => {
    expect([summary.minPerTeam, summary.maxPerTeam]).toEqual([6, 6]);
    expect(summary.maxGamesInADay).toBeLessThanOrEqual(3);
    for (const t of teams) {
      const pool = plan.games.filter((g) => g.stage === 'pool');
      expect(pool.filter((g) => g.home === t.id)).toHaveLength(3);
      expect(pool.filter((g) => g.away === t.id)).toHaveLength(3);
    }
  });

  it('never pairs two teams from the same organization, and only 1 same-state game', () => {
    const club = new Map(teams.map((t) => [t.id, t.club.trim().toLowerCase()]));
    for (const g of plan.games.filter((x) => x.stage === 'pool')) expect(club.get(g.home!)).not.toBe(club.get(g.away!));
    expect(summary.sameStateGames).toBe(1);
  });

  it('games per day: 84, 84, 84, 72, 66, 7', () => {
    expect(summary.perDay.map((d) => d.games)).toEqual([84, 84, 84, 72, 66, 7]);
    expect(summary.perDay[3].pool).toBe(48);
  });

  it('brackets: Championship 34 (seeds 1–34), Monster 33, Cooper 33', () => {
    expect(plan.brackets.map((b) => [b.name, b.teams, b.seeds, b.byes])).toEqual([
      ['Championship', 34, '1–34', 30],
      ['Monster', 33, '35–67', 31],
      ['Cooper', 33, '68–100', 31],
    ]);
  });

  it('brackets start Wed 6 PM; Championship final Fri 8 AM; Monster and Cooper finals Fri noon', () => {
    const bracket = plan.games.filter((g) => g.stage === 'bracket');
    const first = bracket.map((g) => `${g.slot.date} ${g.slot.time}`).sort()[0];
    expect(first).toBe('2027-06-02 18:00');
    const final = (name: string) => bracket.find((g) => g.label === `${name} Final`)!;
    expect(`${final('Championship').slot.date} ${final('Championship').slot.time}`).toBe('2027-06-04 08:00');
    expect(`${final('Monster').slot.date} ${final('Monster').slot.time}`).toBe('2027-06-04 12:00');
    expect(`${final('Cooper').slot.date} ${final('Cooper').slot.time}`).toBe('2027-06-04 12:00');
  });
});

describe('the app gives the brief’s schedule however the teams were loaded', () => {
  it('same result from a shuffled team list', async () => {
    const { planEventWeek } = await import('../../data/services');
    const asTeams = WEEK1_2027_TEAMS.map((t, i) => ({
      id: `t${i + 1}`, eventId: 'w1', name: t.name, city: t.city, state: t.state, code: null, pool: null,
      organization: t.organization, rosterSize: t.players, coachName: null, coachEmail: null, coachPhone: null, externalId: null,
    }));
    const shuffled = [...asTeams].sort((a, b) => a.state.localeCompare(b.state) || b.name.localeCompare(a.name));
    const fromApp = planEventWeek(shuffled, settings);
    const s = planSummary(teams, fromApp, settings);
    expect(s.sameStateGames).toBe(1);
    expect(s.perDay.map((d) => d.games)).toEqual([84, 84, 84, 72, 66, 7]);
    expect(fromApp.games.map((g) => `${g.slot.index}|${g.field}|${g.home}|${g.away}|${g.homeFrom}|${g.awayFrom}`)).toEqual(
      plan.games.map((g) => `${g.slot.index}|${g.field}|${g.home}|${g.away}|${g.homeFrom}|${g.awayFrom}`),
    );
  });
});
