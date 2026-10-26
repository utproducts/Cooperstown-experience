import { describe, expect, it } from 'vitest';
import {
  toCheckin,
  toEvent,
  toGame,
  toGameInsert,
  toGamePatch,
  toTeam,
  toUmpireCode,
  umpGameToGame,
  winnerIndex,
  type GameRow,
} from '../../data/cooperstown-map';
import { localTimeKey } from '../time';

// Real rows from the Cooperstown database (Week 1 2027), read 2026-10-26. No team contacts.
const WEEK = {
  id: '3105d88f-393c-4984-bb0d-3e324c079823',
  name: 'Week 1',
  start_date: '2027-05-30',
  end_date: '2027-06-04',
  published: true,
  settings: { brackets: ['Championship', 'Monster', 'Cooper'], poolGames: 6, maxPerDay: 3, restSlots: 1, slotMinutes: 120, checkinItems: ['Roster verified', 'Waivers signed', 'Wristbands handed out', 'Lodging keys'], bracketMaxPerDay: 4 },
};
const TEAM = { id: '9974e64e-e831-48c3-950d-fee72b2edb6f', week_id: WEEK.id, age_group: '12U', name: '12U Arizona Elite Baseball Academy', organization: 'Arizona Elite Baseball Academy', city: 'Scottsdale', state: 'AZ', players: 11, coaches: 2 };
const base = { week_id: WEEK.id, age_group: '12U', round: 0, scored_by: '', home_score: null, away_score: null, baseballs_used: null, status: 'scheduled' as const };
const GAMES: GameRow[] = [
  { ...base, id: 1, stage: 'pool', label: 'Pool game 1', bracket: '', game_date: '2027-05-30', start_time: '08:00:00', field_id: 1, home_team: '60fff85c-26c6-4009-bff9-ee410dbebab4', away_team: 'fb5c0a18-1563-4f75-8baf-ca5e931fddc6', home_from: '', away_from: '', home_score: 7, away_score: 4, baseballs_used: 18, status: 'final', scored_by: 'Umpire: Test umpire crew' },
  { ...base, id: 301, stage: 'bracket', round: 1, label: 'Championship Opening round', bracket: 'Championship', game_date: '2027-06-02', start_time: '18:00:00', field_id: 1, home_team: null, away_team: null, home_from: 'seed:32', away_from: 'seed:33' },
  { ...base, id: 305, stage: 'bracket', round: 1, label: 'Championship Opening round', bracket: 'Championship', game_date: '2027-06-02', start_time: '18:00:00', field_id: 5, home_team: null, away_team: null, home_from: 'seed:30', away_from: 'seed:35' },
  { ...base, id: 353, stage: 'bracket', round: 3, label: 'Championship Round of 16', bracket: 'Championship', game_date: '2027-06-03', start_time: '12:00:00', field_id: 5, home_team: null, away_team: null, home_from: 'winner:305', away_from: 'winner:306' },
];
const FIELDS = new Map([
  [1, 'Field 1'],
  [5, 'Field 5'],
]);

describe('Cooperstown database mapping', () => {
  it('weeks become events at the All Star Village, keeping settings and publish state', () => {
    const e = toEvent(WEEK);
    expect(e).toMatchObject({ id: WEEK.id, name: 'Week 1', startsOn: '2027-05-30', endsOn: '2027-06-04', published: true, timezone: 'America/New_York' });
    expect(e.venue).toBe('Cooperstown All Star Village');
    expect((e.settings as { checkinItems: string[] }).checkinItems).toHaveLength(4);
  });

  it('teams keep organization and roster size; reps only when given', () => {
    expect(toTeam(TEAM)).toMatchObject({ name: TEAM.name, organization: 'Arizona Elite Baseball Academy', rosterSize: 11, code: null, coachName: null });
    expect(toTeam(TEAM, { team_id: TEAM.id, rep_name: 'Pat', rep_email: 'p@x.io', rep_phone: '' })).toMatchObject({ coachName: 'Pat', coachEmail: 'p@x.io', coachPhone: null });
  });

  it('a scored pool game: Eastern time, field name, score, baseballs, who scored', () => {
    const g = toGame(GAMES[0], FIELDS, winnerIndex(GAMES));
    expect(g).toMatchObject({ id: '1', number: 1, field: 'Field 1', stage: 'pool', bracket: null, round: 'Pool game 1', homeScore: 7, awayScore: 4, baseballsUsed: 18, status: 'final' });
    expect(g.startsAt).toBe('2027-05-30T12:00:00.000Z'); // 8 AM EDT
    expect(g.note).toBe('Scored by Umpire: Test umpire crew');
  });

  it('bracket games: seeds, bracket name, round, and where the winner goes', () => {
    const winners = winnerIndex(GAMES);
    const opening = toGame(GAMES[1], FIELDS, winners);
    expect(opening).toMatchObject({ bracket: 'Championship', round: 'Opening round', homeSeed: 32, awaySeed: 33, homeLabel: 'Seed #32', awayLabel: 'Seed #33' });
    const fed = toGame(GAMES[2], FIELDS, winners);
    expect(fed).toMatchObject({ winnerToGameId: '353', winnerToSlot: 'home' });
    const r16 = toGame(GAMES[3], FIELDS, winners);
    expect(r16).toMatchObject({ round: 'Round of 16', homeLabel: 'Winner G305', awayLabel: 'Winner G306', homeSeed: null });
  });

  it('changes map back to columns; live/delayed stay "scheduled"', () => {
    const ids = new Map([['Field 5', 5]]);
    const row = toGamePatch({ startsAt: '2027-06-03T20:00:00.000Z', field: 'Field 5', status: 'delayed' }, ids);
    expect(row).toMatchObject({ game_date: '2027-06-03', start_time: '16:00', field_id: 5, status: 'scheduled' });
    expect(toGamePatch({ status: 'cancelled' }, ids).status).toBe('cancelled');
    expect(toGamePatch({}, ids)).toEqual({});
  });

  it('new games from the builder become rows with seed sources', () => {
    const row = toGameInsert(
      { eventId: WEEK.id, stage: 'bracket', bracket: 'Monster', round: 'Final', startsAt: '2027-06-04T16:00:00.000Z', field: 'Field 5', homeSeed: null, awaySeed: 35, homeTeamId: null, awayTeamId: null },
      { fieldId: new Map([['Field 5', 5]]), ageGroup: '12U' },
    );
    expect(row).toMatchObject({ week_id: WEEK.id, age_group: '12U', stage: 'bracket', label: 'Monster Final', bracket: 'Monster', game_date: '2027-06-04', start_time: '12:00', field_id: 5, home_from: '', away_from: 'seed:35' });
    expect(localTimeKey('2027-06-04T16:00:00.000Z')).toBe('12:00');
  });

  it('umpire codes and team check-ins', () => {
    expect(toUmpireCode({ id: 4, week_id: WEEK.id, code: 'K7Q2XM', label: 'Mike R.', active: true, last_used_at: null })).toEqual({
      id: '4', eventId: WEEK.id, code: 'K7Q2XM', label: 'Mike R.', active: true, lastUsedAt: null,
    });
    expect(toCheckin({ team_id: TEAM.id, items: { 'Waivers signed': true }, notes: '', checked_in_at: null, checked_in_by: '' })).toMatchObject({ id: TEAM.id, teamId: TEAM.id });
  });

  it("umpire games (team names only) become games the umpire screen can show", () => {
    const g = umpGameToGame(
      { id: 301, label: 'Championship Opening round', date: '2027-06-02', time: '18:00', field: 'Field 1', home: null, away: null, homeFrom: 'seed:32', awayFrom: 'seed:33', homeScore: null, awayScore: null, baseballs: null, status: 'scheduled' },
      WEEK.id,
    );
    expect(g).toMatchObject({ stage: 'bracket', bracket: 'Championship', round: 'Opening round', homeLabel: 'Seed #32', field: 'Field 1' });
    const p = umpGameToGame(
      { id: 2, label: 'Pool game 1', date: '2027-05-30', time: '08:00', field: 'Field 2', home: '12U Indiana Primetime Red', away: 'X', homeFrom: '', awayFrom: '', homeScore: null, awayScore: null, baseballs: null, status: 'scheduled' },
      WEEK.id,
    );
    expect(p).toMatchObject({ stage: 'pool', homeTeamId: '12U Indiana Primetime Red', round: 'Pool game 1' });
  });
});
