// Row <-> model mapping for the Cooperstown All Star Village database (utproducts/cooperstown, Supabase project
// "cooperstown"). Pure: no network here, so it's tested against real rows.
import { DEFAULT_TZ, localDateKey, localTimeKey, zonedToIso } from '../lib/time';
import type { EventWeek, Game, Team, TeamCheckin, UmpireCode } from './types';

// The tournament's grounds (weather and directions).
export const VENUE = {
  venue: 'Cooperstown All Star Village',
  address: '4158 State Highway 7, Oneonta, NY 13820',
  latitude: 42.4512,
  longitude: -75.0663,
};

export interface WeekRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  published: boolean;
  settings: Record<string, unknown> | null;
}
export interface TeamRow {
  id: string;
  week_id: string;
  age_group: string;
  name: string;
  organization: string;
  city: string;
  state: string;
  players: number | null;
  coaches: number | null;
  sort?: number;
}
export interface ContactRow {
  team_id: string;
  rep_name: string;
  rep_email: string;
  rep_phone: string;
}
export interface FieldRow {
  id: number;
  week_id: string;
  name: string;
  sort: number;
}
export interface GameRow {
  id: number;
  week_id: string;
  age_group: string;
  stage: 'pool' | 'bracket';
  round: number;
  label: string;
  bracket: string;
  game_date: string | null;
  start_time: string | null;
  field_id: number | null;
  home_team: string | null;
  away_team: string | null;
  home_from: string;
  away_from: string;
  home_score: number | null;
  away_score: number | null;
  baseballs_used: number | null;
  status: 'scheduled' | 'final' | 'cancelled';
  scored_by: string;
}
export interface UmpireCodeRow {
  id: number;
  week_id: string;
  code: string;
  label: string;
  active: boolean;
  last_used_at: string | null;
}
export interface CheckinRow {
  team_id: string;
  items: Record<string, boolean>;
  notes: string;
  checked_in_at: string | null;
  checked_in_by: string;
}

const blank = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

export function toEvent(w: WeekRow): EventWeek {
  return {
    id: w.id,
    name: w.name,
    startsOn: w.start_date,
    endsOn: w.end_date,
    ...VENUE,
    checkInWindow: 'Arrival day, at the check-in desk',
    timezone: DEFAULT_TZ,
    published: w.published,
    settings: w.settings ?? null,
  };
}

export function toTeam(t: TeamRow, contact?: ContactRow | null): Team {
  return {
    id: t.id,
    eventId: t.week_id,
    name: t.name,
    city: t.city,
    state: t.state,
    code: null,
    pool: null,
    organization: blank(t.organization),
    rosterSize: t.players,
    coachName: blank(contact?.rep_name),
    coachEmail: blank(contact?.rep_email),
    coachPhone: blank(contact?.rep_phone),
    externalId: null,
  };
}

/** For each game id, the game its winner moves into (from the later game's "winner:<id>"). */
export function winnerIndex(rows: Pick<GameRow, 'id' | 'home_from' | 'away_from'>[]): Map<number, { id: number; slot: 'home' | 'away' }> {
  const out = new Map<number, { id: number; slot: 'home' | 'away' }>();
  for (const r of rows) {
    if (r.home_from.startsWith('winner:')) out.set(Number(r.home_from.slice(7)), { id: r.id, slot: 'home' });
    if (r.away_from.startsWith('winner:')) out.set(Number(r.away_from.slice(7)), { id: r.id, slot: 'away' });
  }
  return out;
}

function fromSide(from: string) {
  if (from.startsWith('seed:')) {
    const n = Number(from.slice(5));
    return { seed: n, label: `Seed #${n}` };
  }
  if (from.startsWith('winner:')) return { seed: null, label: `Winner G${from.slice(7)}` };
  return { seed: null, label: null };
}

export function toGame(g: GameRow, fieldName: Map<number, string>, winners: Map<number, { id: number; slot: 'home' | 'away' }>, timeZone = DEFAULT_TZ): Game {
  const home = fromSide(g.home_from);
  const away = fromSide(g.away_from);
  const next = winners.get(g.id);
  const bracket = blank(g.bracket);
  return {
    id: String(g.id),
    eventId: g.week_id,
    field: (g.field_id !== null && fieldName.get(g.field_id)) || 'Field TBD',
    // Unscheduled games (no date yet) sort last.
    startsAt: g.game_date ? zonedToIso(g.game_date, (g.start_time ?? '00:00').slice(0, 5), timeZone) : '9999-12-31T00:00:00.000Z',
    homeTeamId: g.home_team,
    awayTeamId: g.away_team,
    homeLabel: home.label,
    awayLabel: away.label,
    homeSeed: home.seed,
    awaySeed: away.seed,
    homeScore: g.home_score,
    awayScore: g.away_score,
    status: g.status,
    stage: g.stage,
    bracket,
    // Labels are "Pool game 3" or "Monster Round of 32"; the bracket is its own field here.
    round: bracket && g.label.startsWith(bracket) ? g.label.slice(bracket.length).trim() : g.label,
    number: g.id,
    winnerToGameId: next ? String(next.id) : null,
    winnerToSlot: next?.slot ?? null,
    note: blank(g.scored_by) ? `Scored by ${g.scored_by}` : null,
    baseballsUsed: g.baseballs_used,
  };
}

/** A partial game change → database columns. Scores going final are handled by the staff_score function instead. */
export function toGamePatch(patch: Partial<Game>, fieldId: Map<string, number>, timeZone = DEFAULT_TZ): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.startsAt !== undefined) {
    row.game_date = localDateKey(patch.startsAt, timeZone);
    row.start_time = localTimeKey(patch.startsAt, timeZone);
  }
  if (patch.field !== undefined) row.field_id = fieldId.get(patch.field) ?? null;
  if (patch.homeTeamId !== undefined) row.home_team = patch.homeTeamId;
  if (patch.awayTeamId !== undefined) row.away_team = patch.awayTeamId;
  if (patch.homeScore !== undefined) row.home_score = patch.homeScore;
  if (patch.awayScore !== undefined) row.away_score = patch.awayScore;
  if (patch.baseballsUsed !== undefined) row.baseballs_used = patch.baseballsUsed;
  // The database knows scheduled / final / cancelled; live, delayed and postponed are still "scheduled".
  if (patch.status !== undefined) row.status = patch.status === 'cancelled' || patch.status === 'final' ? patch.status : 'scheduled';
  if (Object.keys(row).length) row.updated_at = new Date().toISOString();
  return row;
}

/** A new game (from the schedule builder) → a row. Winner links are set afterwards, once ids exist. */
export function toGameInsert(g: Partial<Game>, ctx: { fieldId: Map<string, number>; ageGroup: string; timeZone?: string }): Record<string, unknown> {
  const tz = ctx.timeZone ?? DEFAULT_TZ;
  const bracket = g.bracket ?? '';
  return {
    week_id: g.eventId,
    age_group: ctx.ageGroup,
    stage: g.stage ?? 'pool',
    round: 0,
    label: g.stage === 'bracket' && bracket ? `${bracket} ${g.round ?? ''}`.trim() : (g.round ?? ''),
    bracket,
    game_date: g.startsAt ? localDateKey(g.startsAt, tz) : null,
    start_time: g.startsAt ? localTimeKey(g.startsAt, tz) : null,
    field_id: g.field ? (ctx.fieldId.get(g.field) ?? null) : null,
    home_team: g.homeTeamId ?? null,
    away_team: g.awayTeamId ?? null,
    home_from: g.homeSeed ? `seed:${g.homeSeed}` : '',
    away_from: g.awaySeed ? `seed:${g.awaySeed}` : '',
  };
}

export function toUmpireCode(c: UmpireCodeRow): UmpireCode {
  return { id: String(c.id), eventId: c.week_id, code: c.code, label: c.label, active: c.active, lastUsedAt: c.last_used_at };
}

export function toCheckin(c: CheckinRow): TeamCheckin {
  return { id: c.team_id, teamId: c.team_id, items: c.items ?? {}, notes: c.notes ?? '', checkedInAt: c.checked_in_at, checkedInBy: c.checked_in_by ?? '' };
}

/** ump_games' game shape → Game (teams are only known by name there, so the name doubles as the id). */
export function umpGameToGame(
  g: {
    id: number;
    label: string;
    date: string | null;
    time: string | null;
    field: string | null;
    home: string | null;
    away: string | null;
    homeFrom: string;
    awayFrom: string;
    homeScore: number | null;
    awayScore: number | null;
    baseballs: number | null;
    status: 'scheduled' | 'final' | 'cancelled';
  },
  weekId: string,
  timeZone = DEFAULT_TZ,
): Game {
  const home = fromSide(g.homeFrom ?? '');
  const away = fromSide(g.awayFrom ?? '');
  const bracketMatch = g.label.match(/^(.*?) (Opening round|Round of \d+|Quarterfinal|Semifinal|Final|Championship)$/);
  return {
    id: String(g.id),
    eventId: weekId,
    field: g.field ?? 'Field TBD',
    startsAt: g.date ? zonedToIso(g.date, (g.time ?? '00:00').slice(0, 5), timeZone) : '9999-12-31T00:00:00.000Z',
    homeTeamId: g.home,
    awayTeamId: g.away,
    homeLabel: home.label,
    awayLabel: away.label,
    homeSeed: home.seed,
    awaySeed: away.seed,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    status: g.status,
    stage: home.seed || away.seed || g.homeFrom?.startsWith('winner:') || bracketMatch ? 'bracket' : 'pool',
    bracket: bracketMatch ? bracketMatch[1] : null,
    round: bracketMatch ? bracketMatch[2] : g.label,
    number: g.id,
    winnerToGameId: null,
    winnerToSlot: null,
    note: null,
    baseballsUsed: g.baseballs,
  };
}
