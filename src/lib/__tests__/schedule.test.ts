import { describe, expect, it } from 'vitest';
import type { Game } from '../../data/types';
import { bracketAdvance, computeStandings, fieldNames, overallSeeds, shiftGames } from '../schedule';
import { zonedToIso } from '../time';


function game(p: Partial<Game> & Pick<Game, 'id'>): Game {
  return {
    eventId: 'e',
    field: 'Field 1',
    startsAt: zonedToIso('2026-07-12', '08:00'),
    homeTeamId: null,
    awayTeamId: null,
    homeLabel: null,
    awayLabel: null,
    homeSeed: null,
    awaySeed: null,
    baseballsUsed: null,
    homeScore: null,
    awayScore: null,
    status: 'scheduled',
    stage: 'pool',
    bracket: null,
    round: null,
    number: 1,
    winnerToGameId: null,
    winnerToSlot: null,
    note: null,
    ...p,
  };
}

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

  it('breaks a two-team tie head to head before runs allowed', () => {
    const two = [
      { id: 'x', pool: null },
      { id: 'y', pool: null },
      { id: 'z', pool: null },
    ];
    const g = [
      game({ id: 'h1', homeTeamId: 'x', awayTeamId: 'y', homeScore: 3, awayScore: 2, status: 'final' }),
      game({ id: 'h2', homeTeamId: 'z', awayTeamId: 'x', homeScore: 12, awayScore: 0, status: 'final' }),
      game({ id: 'h3', homeTeamId: 'y', awayTeamId: 'z', homeScore: 1, awayScore: 0, status: 'final' }),
    ];
    // All three finish 1-1, so head to head doesn't apply; fewest runs allowed decides (z 1, y 3, x 14).
    expect(computeStandings(two, g).map((r) => r.teamId)).toEqual(['z', 'y', 'x']);
    const tied = computeStandings(two.slice(0, 2), [
      game({ id: 't1', homeTeamId: 'x', awayTeamId: 'y', homeScore: 3, awayScore: 2, status: 'final' }),
      game({ id: 't2', homeTeamId: 'q', awayTeamId: 'x', homeScore: 10, awayScore: 0, status: 'final' }),
      game({ id: 't3', homeTeamId: 'y', awayTeamId: 'q', homeScore: 1, awayScore: 0, status: 'final' }),
    ]);
    // x and y both 1-1, y allowed 3 runs to x's 12, but x won the head-to-head game.
    expect(tied.map((r) => r.teamId)).toEqual(['x', 'y']);
  });

  it('seeds across pools', () => {
    expect(overallSeeds(teams, games)).toEqual(['c', 'a', 'b']);
  });
});

describe('bracket', () => {
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

describe('fieldNames', () => {
  it('names 12 fields', () => {
    expect(fieldNames(12)).toHaveLength(12);
    expect(fieldNames(12)[11]).toBe('Field 12');
  });
});
