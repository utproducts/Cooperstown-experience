import { describe, expect, it } from 'vitest';

import type { Game } from '../../data/types';
import { findConflicts } from '../game-conflicts';
import { zonedToIso } from '../time';

let n = 0;
const g = (field: string, date: string, time: string, home: string | null, away: string | null, extra: Partial<Game> = {}): Game => ({
  id: `g${++n}`,
  number: n,
  eventId: 'w1',
  field,
  startsAt: zonedToIso(date, time),
  homeTeamId: home,
  awayTeamId: away,
  homeLabel: null,
  awayLabel: null,
  homeSeed: null,
  awaySeed: null,
  homeScore: null,
  awayScore: null,
  status: 'scheduled',
  stage: 'pool',
  bracket: null,
  round: null,
  winnerToGameId: null,
  winnerToSlot: null,
  note: null,
  baseballsUsed: null,
  ...extra,
});

describe('findConflicts', () => {
  const moving = g('Field 1', '2027-05-30', '08:00', 'A', 'B');
  const week = [
    moving,
    g('Field 2', '2027-05-30', '10:00', 'C', 'D'),
    g('Field 3', '2027-05-30', '12:00', 'A', 'E'),
    g('Field 4', '2027-05-30', '16:00', 'B', 'F'),
    g('Field 5', '2027-05-30', '20:00', 'B', 'G'),
    g('Field 6', '2027-05-30', '10:00', 'H', 'I', { status: 'cancelled' }),
  ];
  const at = (field: string, time: string, home = 'A', away = 'B') => findConflicts(moving, { startsAt: zonedToIso('2027-05-30', time), field, homeTeamId: home, awayTeamId: away }, week);
  const kinds = (c: ReturnType<typeof at>) => c.map((x) => `${x.kind}${x.game ? `:G${x.game.number}` : ''}`).sort();

  it('a free field and rested teams is fine', () => {
    expect(at('Field 1', '08:00')).toEqual([]);
  });

  it('flags a field that already has a game in that slot', () => {
    expect(kinds(at('Field 2', '10:00', 'X', 'Y'))).toEqual(['field:G2']);
    expect(kinds(at('Field 2', '11:00', 'X', 'Y'))).toEqual(['field:G2']);
    expect(kinds(at('Field 2', '12:00', 'X', 'Y'))).toEqual([]);
  });

  it('ignores cancelled games', () => {
    expect(kinds(at('Field 6', '10:00', 'X', 'Y'))).toEqual([]);
  });

  it('flags a team that is already playing, and a game with no rest slot', () => {
    expect(kinds(at('Field 7', '12:00'))).toEqual(['team:G3']);
    // A plays G3 at noon: 10:00 is right before it, 14:00 right after.
    expect(kinds(at('Field 7', '10:00'))).toEqual(['rest:G3']);
    expect(kinds(at('Field 7', '14:00'))).toEqual(['rest:G3', 'rest:G4']);
  });

  it('flags a fourth game in a day and a team playing itself', () => {
    const busyDay = [moving, g('Field 2', '2027-05-30', '12:00', 'B', 'J'), g('Field 3', '2027-05-30', '16:00', 'B', 'K'), g('Field 4', '2027-05-30', '20:00', 'B', 'L')];
    const c = findConflicts(moving, { startsAt: moving.startsAt, field: 'Field 1', homeTeamId: 'A', awayTeamId: 'B' }, busyDay);
    expect(c.map((x) => x.kind)).toEqual(['per-day']);
    expect(c[0].message).toContain('4 games that day (limit 3)');
    expect(kinds(at('Field 1', '08:00', 'A', 'A'))).toContain('same-team');
  });
});
