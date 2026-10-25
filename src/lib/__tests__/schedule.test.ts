import { describe, expect, it } from 'vitest';
import type { Game } from '../../data/types';
import {
  assignPools,
  bracketAdvance,
  buildBracket,
  buildPoolMatchups,
  computeStandings,
  overallSeeds,
  placeMatchups,
  roundRobin,
  shiftGames,
} from '../schedule';
import { zonedToIso } from '../time';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`);

function game(p: Partial<Game> & Pick<Game, 'id'>): Game {
  return {
    eventId: 'e',
    field: 'Field 1',
    startsAt: zonedToIso('2026-07-12', '08:00'),
    homeTeamId: null,
    awayTeamId: null,
    homeLabel: null,
    awayLabel: null,
    homeScore: null,
    awayScore: null,
    status: 'scheduled',
    stage: 'pool',
    round: null,
    number: 1,
    winnerToGameId: null,
    winnerToSlot: null,
    note: null,
    ...p,
  };
}

describe('roundRobin', () => {
  it('gives every pair exactly once in a full round robin', () => {
    const rounds = roundRobin(ids(6));
    expect(rounds).toHaveLength(5);
    const pairs = rounds.flat().map(([a, b]) => [a, b].sort().join('-'));
    expect(new Set(pairs).size).toBe(15);
    for (const r of rounds) expect(new Set(r.flat()).size).toBe(r.flat().length);
  });

  it('handles odd pools with byes', () => {
    const rounds = roundRobin(ids(5));
    expect(rounds).toHaveLength(5);
    expect(rounds.flat()).toHaveLength(10);
  });

  it('limits rounds for partial round robins', () => {
    const rounds = roundRobin(ids(10), 6);
    const counts = new Map<string, number>();
    rounds.flat().flat().forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
    expect([...counts.values()].every((c) => c === 6)).toBe(true);
  });
});

describe('assignPools', () => {
  it('snakes teams across pools', () => {
    const pools = assignPools(ids(8).map((id) => ({ id })), 4);
    expect([...pools.values()]).toEqual(['A', 'B', 'C', 'D', 'D', 'C', 'B', 'A']);
  });
});

describe('placeMatchups', () => {
  it('never double-books a team and respects the gap and daily cap', () => {
    const teams = ids(12).map((id, i) => ({ id, pool: i < 6 ? 'A' : 'B' }));
    const matchups = buildPoolMatchups(teams, 5);
    expect(matchups).toHaveLength(30);
    const grid = {
      days: ['2026-07-12', '2026-07-13', '2026-07-14'],
      times: ['08:00', '10:15', '12:30', '14:45', '17:00', '19:15'],
      fields: ['F1', 'F2', 'F3'],
    };
    const res = placeMatchups(matchups, grid, { minGapMinutes: 240, maxGamesPerTeamPerDay: 2 });
    expect(res.unscheduled).toHaveLength(0);
    const byTeam = new Map<string, number[]>();
    for (const g of res.scheduled) {
      for (const t of [g.homeTeamId, g.awayTeamId]) {
        byTeam.set(t, [...(byTeam.get(t) ?? []), new Date(g.startsAt).getTime()]);
      }
    }
    for (const times of byTeam.values()) {
      times.sort((a, b) => a - b);
      for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(240 * 60000);
    }
    const slotField = res.scheduled.map((g) => `${g.startsAt}|${g.field}`);
    expect(new Set(slotField).size).toBe(slotField.length);
  });

  it('reports what cannot fit', () => {
    const matchups = buildPoolMatchups(ids(4).map((id) => ({ id, pool: 'A' })), 3);
    const res = placeMatchups(matchups, { days: ['2026-07-12'], times: ['08:00'], fields: ['F1'] }, { minGapMinutes: 0, maxGamesPerTeamPerDay: 5 });
    expect(res.scheduled).toHaveLength(1);
    expect(res.unscheduled).toHaveLength(5);
  });
});

describe('standings', () => {
  const teams = [
    { id: 'a', pool: 'A' },
    { id: 'b', pool: 'A' },
    { id: 'c', pool: 'A' },
  ];
  const games = [
    game({ id: 'g1', homeTeamId: 'a', awayTeamId: 'b', homeScore: 20, awayScore: 0, status: 'final' }),
    game({ id: 'g2', homeTeamId: 'c', awayTeamId: 'b', homeScore: 5, awayScore: 4, status: 'final' }),
    game({ id: 'g3', homeTeamId: 'a', awayTeamId: 'c', homeScore: 1, awayScore: 2, status: 'final' }),
    game({ id: 'g4', homeTeamId: 'b', awayTeamId: 'c', homeScore: 9, awayScore: 0, status: 'scheduled' }),
  ];

  it('caps run differential and ignores unfinished games', () => {
    const s = computeStandings(teams, games);
    const a = s.find((r) => r.teamId === 'a')!;
    expect(a).toMatchObject({ wins: 1, losses: 1, runsFor: 21, runsAgainst: 2, runDiff: 7 });
    expect(s.map((r) => r.teamId)).toEqual(['c', 'a', 'b']);
  });

  it('seeds across pools', () => {
    expect(overallSeeds(computeStandings(teams, games))).toEqual(['c', 'a', 'b']);
  });
});

describe('bracket', () => {
  it('builds a full 8-team bracket with standard seeding', () => {
    const b = buildBracket(ids(8));
    expect(b).toHaveLength(7);
    const r1 = b.filter((g) => g.round === 1);
    expect(r1.map((g) => [g.homeTeamId, g.awayTeamId])).toEqual([
      ['t1', 't8'],
      ['t4', 't5'],
      ['t2', 't7'],
      ['t3', 't6'],
    ]);
    expect(b.find((g) => g.key === 'R1-1')!.winnerTo).toEqual({ key: 'R2-1', slot: 'home' });
    expect(b.find((g) => g.key === 'R1-2')!.winnerTo).toEqual({ key: 'R2-1', slot: 'away' });
    expect(b.find((g) => g.round === 3)!.roundName).toBe('Championship');
  });

  it('gives byes to top seeds', () => {
    const b = buildBracket(ids(6));
    expect(b).toHaveLength(5);
    const r2 = b.filter((g) => g.round === 2);
    expect(r2[0].homeTeamId).toBe('t1');
    // keys are bracket positions, so the 1-vs-8 slot (a bye) has no game
    expect(r2[0].awayLabel).toBe('Winner R1-2');
    expect(b.find((g) => g.key === 'R1-1')).toBeUndefined();
    expect(b.find((g) => g.key === 'R1-2')!.winnerTo).toEqual({ key: 'R2-1', slot: 'away' });
  });

  it('advances the winner', () => {
    const g = game({ id: 'x', stage: 'bracket', status: 'final', homeTeamId: 'a', awayTeamId: 'b', homeScore: 2, awayScore: 3, winnerToGameId: 'y', winnerToSlot: 'home' });
    expect(bracketAdvance(g)).toEqual({ gameId: 'y', patch: { homeTeamId: 'b' } });
    expect(bracketAdvance({ ...g, homeScore: 3, awayScore: 3 })).toBeNull();
  });
});

describe('shiftGames', () => {
  const games = [
    game({ id: 'g1', homeTeamId: 'a', awayTeamId: 'b', startsAt: zonedToIso('2026-07-12', '08:00') }),
    game({ id: 'g2', homeTeamId: 'c', awayTeamId: 'd', startsAt: zonedToIso('2026-07-12', '10:15') }),
    game({ id: 'g3', homeTeamId: 'e', awayTeamId: 'f', startsAt: zonedToIso('2026-07-12', '10:15'), field: 'Field 2' }),
    game({ id: 'g4', homeTeamId: 'g', awayTeamId: 'h', startsAt: zonedToIso('2026-07-13', '08:00') }),
  ];

  it('moves only the target without cascade', () => {
    const r = shiftGames(games, ['g1'], 30, { cascade: false });
    expect(r.changes).toEqual([{ id: 'g1', startsAt: zonedToIso('2026-07-12', '08:30') }]);
    expect(r.affectedTeamIds.sort()).toEqual(['a', 'b']);
  });

  it('cascades to later games on the same field and day only', () => {
    const r = shiftGames(games, ['g1'], 45, { cascade: true });
    expect(r.changes.map((c) => c.id)).toEqual(['g1', 'g2']);
    expect(r.affectedTeamIds.sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});
