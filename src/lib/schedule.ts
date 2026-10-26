import type { Game, Team } from '../data/types';
import { addMinutes, localDateKey, zonedToIso, DEFAULT_TZ } from './time';

export interface Matchup {
  pool: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
}

/** Splits teams into `poolCount` pools, snake-ordered so pools are balanced. */
export function assignPools<T extends { id: string }>(teams: T[], poolCount: number): Map<string, string> {
  const result = new Map<string, string>();
  const names = Array.from({ length: Math.max(1, poolCount) }, (_, i) => String.fromCharCode(65 + i));
  teams.forEach((t, i) => {
    const lap = Math.floor(i / names.length);
    const pos = i % names.length;
    result.set(t.id, names[lap % 2 === 0 ? pos : names.length - 1 - pos]);
  });
  return result;
}

/**
 * Round-robin pairings via the circle method. With `rounds` smaller than a
 * full round robin, each team plays `rounds` games (one per round), minus a
 * possible bye when the pool has an odd number of teams.
 */
export function roundRobin(teamIds: string[], rounds?: number): [string, string][][] {
  const ids = [...teamIds];
  if (ids.length < 2) return [];
  if (ids.length % 2 === 1) ids.push('__BYE__');
  const n = ids.length;
  const total = Math.min(rounds ?? n - 1, n - 1);
  const out: [string, string][][] = [];
  const rot = ids.slice(1);
  for (let r = 0; r < total; r++) {
    const order = [ids[0], ...rot];
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = order[i];
      const b = order[n - 1 - i];
      if (a === '__BYE__' || b === '__BYE__') continue;
      // Alternate home/away so teams aren't always the home side.
      pairs.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
    }
    out.push(pairs);
    rot.unshift(rot.pop()!);
  }
  return out;
}

export function buildPoolMatchups(teams: Pick<Team, 'id' | 'pool'>[], gamesPerTeam: number): Matchup[] {
  const pools = new Map<string, string[]>();
  for (const t of teams) {
    const p = t.pool ?? 'A';
    if (!pools.has(p)) pools.set(p, []);
    pools.get(p)!.push(t.id);
  }
  const matchups: Matchup[] = [];
  for (const [pool, ids] of [...pools.entries()].sort()) {
    roundRobin(ids, gamesPerTeam).forEach((pairs, round) => {
      for (const [h, a] of pairs) matchups.push({ pool, round, homeTeamId: h, awayTeamId: a });
    });
  }
  return matchups;
}

export interface SlotGrid {
  /** ISO dates of play days. */
  days: string[];
  /** Start times ("08:00") used every day. */
  times: string[];
  fields: string[];
  timeZone?: string;
}

export interface ScheduleOptions {
  /** Minutes between the start of one game and the next game for the same team. */
  minGapMinutes: number;
  maxGamesPerTeamPerDay: number;
}

export interface ScheduledMatchup extends Matchup {
  field: string;
  startsAt: string;
}

export interface ScheduleResult {
  scheduled: ScheduledMatchup[];
  unscheduled: Matchup[];
}

/**
 * Greedily places matchups into the slot grid in chronological order. Earlier
 * rounds are placed first; a team is never double-booked, respects the
 * minimum gap and the daily cap.
 */
export function placeMatchups(matchups: Matchup[], grid: SlotGrid, opts: ScheduleOptions): ScheduleResult {
  const tz = grid.timeZone ?? DEFAULT_TZ;
  const pending = [...matchups].sort((a, b) => a.round - b.round || a.pool.localeCompare(b.pool));
  const lastStart = new Map<string, number>();
  const perDay = new Map<string, number>();
  const played = new Map<string, number>();
  const scheduled: ScheduledMatchup[] = [];

  const slots = grid.days.flatMap((day) => [...grid.times].sort().map((time) => ({ day, iso: zonedToIso(day, time, tz) })));

  for (const slot of slots) {
    const ts = new Date(slot.iso).getTime();
    const busy = new Set<string>();
    for (const field of grid.fields) {
      const ok = (id: string) => {
        if (busy.has(id)) return false;
        const last = lastStart.get(id);
        if (last !== undefined && ts - last < opts.minGapMinutes * 60000) return false;
        return (perDay.get(`${id}|${slot.day}`) ?? 0) < opts.maxGamesPerTeamPerDay;
      };
      // Among eligible matchups in the lowest available round, prefer teams that have played least.
      let bestIdx = -1;
      let bestScore = Infinity;
      for (let i = 0; i < pending.length; i++) {
        const m = pending[i];
        if (!ok(m.homeTeamId) || !ok(m.awayTeamId)) continue;
        const score = m.round * 1000 + (played.get(m.homeTeamId) ?? 0) + (played.get(m.awayTeamId) ?? 0);
        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) break;
      const [m] = pending.splice(bestIdx, 1);
      for (const id of [m.homeTeamId, m.awayTeamId]) {
        busy.add(id);
        lastStart.set(id, ts);
        perDay.set(`${id}|${slot.day}`, (perDay.get(`${id}|${slot.day}`) ?? 0) + 1);
        played.set(id, (played.get(id) ?? 0) + 1);
      }
      scheduled.push({ ...m, field, startsAt: slot.iso });
    }
    if (pending.length === 0) break;
  }
  return { scheduled, unscheduled: pending };
}

// ---------------------------------------------------------------------------
// Standings

export interface StandingRow {
  teamId: string;
  pool: string;
  wins: number;
  losses: number;
  ties: number;
  runsFor: number;
  runsAgainst: number;
  runDiff: number;
  played: number;
}

/**
 * Pool standings. Ranked by win %, then capped run differential (blowouts
 * count at most `runDiffCap` per game), then fewest runs allowed, then most
 * runs scored.
 */
export function computeStandings(
  teams: Pick<Team, 'id' | 'pool'>[],
  games: Game[],
  runDiffCap = 8,
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const t of teams) {
    rows.set(t.id, { teamId: t.id, pool: t.pool ?? 'A', wins: 0, losses: 0, ties: 0, runsFor: 0, runsAgainst: 0, runDiff: 0, played: 0 });
  }
  for (const g of games) {
    if (g.stage !== 'pool' || g.status !== 'final' || g.homeScore === null || g.awayScore === null) continue;
    const home = g.homeTeamId ? rows.get(g.homeTeamId) : undefined;
    const away = g.awayTeamId ? rows.get(g.awayTeamId) : undefined;
    const apply = (row: StandingRow | undefined, rf: number, ra: number) => {
      if (!row) return;
      row.played++;
      row.runsFor += rf;
      row.runsAgainst += ra;
      row.runDiff += Math.max(-runDiffCap, Math.min(runDiffCap, rf - ra));
      if (rf > ra) row.wins++;
      else if (rf < ra) row.losses++;
      else row.ties++;
    };
    apply(home, g.homeScore, g.awayScore);
    apply(away, g.awayScore, g.homeScore);
  }
  const pct = (r: StandingRow) => (r.played === 0 ? 0 : (r.wins + r.ties * 0.5) / r.played);
  return [...rows.values()].sort(
    (a, b) =>
      a.pool.localeCompare(b.pool) ||
      pct(b) - pct(a) ||
      b.runDiff - a.runDiff ||
      a.runsAgainst - b.runsAgainst ||
      b.runsFor - a.runsFor,
  );
}

/** Overall seeding across pools (pool rank first, then the same tiebreakers). */
export function overallSeeds(standings: StandingRow[]): string[] {
  const rankInPool = new Map<string, number>();
  const counters = new Map<string, number>();
  for (const r of standings) {
    const n = (counters.get(r.pool) ?? 0) + 1;
    counters.set(r.pool, n);
    rankInPool.set(r.teamId, n);
  }
  const pct = (r: StandingRow) => (r.played === 0 ? 0 : (r.wins + r.ties * 0.5) / r.played);
  return [...standings]
    .sort(
      (a, b) =>
        pct(b) - pct(a) ||
        b.runDiff - a.runDiff ||
        a.runsAgainst - b.runsAgainst ||
        rankInPool.get(a.teamId)! - rankInPool.get(b.teamId)! ||
        b.runsFor - a.runsFor,
    )
    .map((r) => r.teamId);
}

// ---------------------------------------------------------------------------
// Bracket

export interface BracketGameDraft {
  key: string;
  round: number;
  roundName: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeLabel: string | null;
  awayLabel: string | null;
  winnerTo: { key: string; slot: 'home' | 'away' } | null;
}

function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2 + 1;
    order = order.flatMap((s) => [s, n - s]);
  }
  return order;
}

function roundName(teamsInRound: number): string {
  // "Final" rather than "Championship": "Championship" is one of the bracket names.
  if (teamsInRound === 2) return 'Final';
  if (teamsInRound === 4) return 'Semifinal';
  if (teamsInRound === 8) return 'Quarterfinal';
  return `Round of ${teamsInRound}`;
}

/**
 * Single-elimination bracket for seeded teams (best first). Top seeds get byes
 * when the field isn't a power of two; byes are resolved immediately so
 * those teams appear directly in the next round.
 */
export function buildBracket(seededTeamIds: string[]): BracketGameDraft[] {
  const n = seededTeamIds.length;
  if (n < 2) return [];
  let size = 1;
  while (size < n) size *= 2;
  const order = seedOrder(size);
  const totalRounds = Math.log2(size);
  const drafts: BracketGameDraft[] = [];
  // entrants for the current round: team id, or a reference to a previous game
  type Entrant = { teamId: string | null; label: string | null; fromKey: string | null };
  let entrants: Entrant[] = order.map((seed) =>
    seed <= n ? { teamId: seededTeamIds[seed - 1], label: `#${seed} seed`, fromKey: null } : { teamId: null, label: null, fromKey: null },
  );
  for (let round = 1; round <= totalRounds; round++) {
    const next: Entrant[] = [];
    const teamsInRound = size / 2 ** (round - 1);
    for (let i = 0; i < entrants.length; i += 2) {
      const a = entrants[i];
      const b = entrants[i + 1];
      const aEmpty = !a.teamId && !a.fromKey;
      const bEmpty = !b.teamId && !b.fromKey;
      if (aEmpty || bEmpty) {
        next.push(aEmpty ? b : a); // bye
        continue;
      }
      const key = `R${round}-${i / 2 + 1}`;
      drafts.push({
        key,
        round,
        roundName: roundName(teamsInRound),
        homeTeamId: a.teamId,
        awayTeamId: b.teamId,
        homeLabel: a.teamId ? a.label : a.label ?? 'TBD',
        awayLabel: b.teamId ? b.label : b.label ?? 'TBD',
        winnerTo: null,
      });
      next.push({ teamId: null, label: `Winner ${key}`, fromKey: key });
    }
    // wire winnerTo links for games that feed this round's games
    for (let i = 0; i < next.length; i += 2) {
      if (next.length < 2) break;
      const nextKey = `R${round + 1}-${i / 2 + 1}`;
      next[i].fromKey && setWinnerTo(drafts, next[i].fromKey!, nextKey, 'home');
      next[i + 1]?.fromKey && setWinnerTo(drafts, next[i + 1].fromKey!, nextKey, 'away');
    }
    entrants = next;
    if (entrants.length === 1) break;
  }
  return drafts;
}

function setWinnerTo(drafts: BracketGameDraft[], fromKey: string, toKey: string, slot: 'home' | 'away') {
  const d = drafts.find((x) => x.key === fromKey);
  if (d) d.winnerTo = { key: toKey, slot };
}

/** Returns the patch to apply to the next bracket game when `game` goes final, or null. */
export function bracketAdvance(game: Game): { gameId: string; patch: Partial<Game> } | null {
  if (game.stage !== 'bracket' || game.status !== 'final' || !game.winnerToGameId || !game.winnerToSlot) return null;
  if (game.homeScore === null || game.awayScore === null || game.homeScore === game.awayScore) return null;
  const winner = game.homeScore > game.awayScore ? game.homeTeamId : game.awayTeamId;
  return game.winnerToSlot === 'home'
    ? { gameId: game.winnerToGameId, patch: { homeTeamId: winner } }
    : { gameId: game.winnerToGameId, patch: { awayTeamId: winner } };
}

// ---------------------------------------------------------------------------
// Delays

export interface ShiftResult {
  changes: { id: string; startsAt: string }[];
  affectedTeamIds: string[];
}

/**
 * Moves the given games by `minutes`. With `cascade`, every later game on the
 * same field and same day also moves by the same amount so nothing overlaps.
 */
export function shiftGames(
  games: Game[],
  targetIds: string[],
  minutes: number,
  { cascade, timeZone = DEFAULT_TZ }: { cascade: boolean; timeZone?: string },
): ShiftResult {
  const ids = new Set(targetIds);
  if (cascade) {
    for (const t of games.filter((g) => targetIds.includes(g.id))) {
      const day = localDateKey(t.startsAt, timeZone);
      for (const g of games) {
        if (
          g.field === t.field &&
          localDateKey(g.startsAt, timeZone) === day &&
          new Date(g.startsAt) > new Date(t.startsAt) &&
          g.status !== 'final' &&
          g.status !== 'cancelled'
        ) {
          ids.add(g.id);
        }
      }
    }
  }
  const changes: ShiftResult['changes'] = [];
  const teams = new Set<string>();
  for (const g of games) {
    if (!ids.has(g.id)) continue;
    changes.push({ id: g.id, startsAt: addMinutes(g.startsAt, minutes) });
    if (g.homeTeamId) teams.add(g.homeTeamId);
    if (g.awayTeamId) teams.add(g.awayTeamId);
  }
  return { changes, affectedTeamIds: [...teams] };
}

// ---------------------------------------------------------------------------
// Cooperstown format: fixed-length games in a daily window, several brackets

/** Start times for back-to-back games, e.g. 08:00–22:00 with 120-minute games → 08:00 … 20:00. */
export function dailySlots(dayStart: string, dayEnd: string, gameMinutes: number): string[] {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const out: string[] = [];
  for (let t = toMin(dayStart); t + gameMinutes <= toMin(dayEnd); t += gameMinutes) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  }
  return out;
}

/** "Field 1" … "Field n" */
export function fieldNames(count: number): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => `Field ${i + 1}`);
}

/**
 * Splits overall seeds (best first) into consecutive tiers, one per bracket
 * name: e.g. top third → Championship, middle → Monster, bottom → Cooper.
 * Earlier brackets take the extra team when the split isn't even.
 */
export function splitIntoBrackets(seeds: string[], names: string[]): { name: string; teamIds: string[] }[] {
  const n = Math.max(1, names.length);
  const base = Math.floor(seeds.length / n);
  const extra = seeds.length % n;
  let i = 0;
  return names.map((name, k) => {
    const size = base + (k < extra ? 1 : 0);
    const teamIds = seeds.slice(i, i + size);
    i += size;
    return { name, teamIds };
  });
}

export interface BracketSchedulingOptions {
  /** ISO dates available for bracket play. */
  days: string[];
  /** Regular start times each day (from dailySlots). */
  times: string[];
  /** Extra start times used only if the brackets can't finish otherwise (e.g. ["22:00"]). */
  lateTimes: string[];
  fields: string[];
  gameMinutes: number;
  /** Most games a team still winning may play in one day (Cooperstown: 4). */
  maxGamesPerTeamPerDay: number;
  timeZone?: string;
  /** Games already on the schedule (pool play) that count toward a team's daily total and occupy fields. */
  existing?: Pick<Game, 'startsAt' | 'field' | 'homeTeamId' | 'awayTeamId'>[];
}

export interface PlacedBracketGame {
  bracket: string;
  draft: BracketGameDraft;
  field: string;
  startsAt: string;
  late: boolean;
}

export interface BracketScheduleResult {
  placed: PlacedBracketGame[];
  unscheduled: { bracket: string; draft: BracketGameDraft }[];
  /** True when late start times were needed to fit everything. */
  usedLate: boolean;
}

/**
 * Schedules every bracket's games into the bracket days. A game starts only
 * after both games feeding it have finished, never double-books a field, and
 * keeps the winner's path within the daily game cap. Late start times are a
 * fallback: they are used only when the brackets don't fit without them.
 */
export function scheduleBrackets(
  brackets: { name: string; drafts: BracketGameDraft[] }[],
  opts: BracketSchedulingOptions,
): BracketScheduleResult {
  const regular = placeBrackets(brackets, opts, false);
  if (regular.unscheduled.length === 0 || opts.lateTimes.length === 0) return regular;
  const withLate = placeBrackets(brackets, opts, true);
  return withLate.unscheduled.length <= regular.unscheduled.length ? withLate : regular;
}

function placeBrackets(
  brackets: { name: string; drafts: BracketGameDraft[] }[],
  opts: BracketSchedulingOptions,
  allowLate: boolean,
): BracketScheduleResult {
  const tz = opts.timeZone ?? DEFAULT_TZ;
  const gameMs = opts.gameMinutes * 60000;
  const lateSet = new Set(opts.lateTimes);
  const times = [...opts.times, ...(allowLate ? opts.lateTimes : [])].sort();
  const slots = opts.days
    .flatMap((day) => times.map((time) => ({ day, iso: zonedToIso(day, time, tz), late: lateSet.has(time) && !opts.times.includes(time) })))
    .sort((a, b) => a.iso.localeCompare(b.iso));

  const fieldsUsed = new Map<string, Set<string>>();
  const occupyField = (iso: string, field: string) => {
    if (!fieldsUsed.has(iso)) fieldsUsed.set(iso, new Set());
    fieldsUsed.get(iso)!.add(field);
  };
  // Existing games per team per day, and their fields.
  const existingPerDay = new Map<string, number>();
  for (const g of opts.existing ?? []) {
    occupyField(g.startsAt, g.field);
    const day = localDateKey(g.startsAt, tz);
    for (const t of [g.homeTeamId, g.awayTeamId]) if (t) existingPerDay.set(`${t}|${day}`, (existingPerDay.get(`${t}|${day}`) ?? 0) + 1);
  }

  // Order: by round, then interleave brackets so no bracket hogs the fields.
  const queue = brackets
    .flatMap((b, bi) => b.drafts.map((d, di) => ({ bracket: b.name, bi, di, draft: d })))
    .sort((a, b) => a.draft.round - b.draft.round || a.di - b.di || a.bi - b.bi);

  // For each placed game: when it ends, its day, and how many games the winner has played that day.
  const done = new Map<string, { endMs: number; day: string; dayCount: number }>();
  const feedersOf = new Map<string, string[]>();
  for (const b of brackets) {
    for (const d of b.drafts) {
      if (d.winnerTo) {
        const k = `${b.name}|${d.winnerTo.key}`;
        feedersOf.set(k, [...(feedersOf.get(k) ?? []), `${b.name}|${d.key}`]);
      }
    }
  }

  const placed: PlacedBracketGame[] = [];
  const unscheduled: BracketScheduleResult['unscheduled'] = [];
  for (const item of queue) {
    const key = `${item.bracket}|${item.draft.key}`;
    const feeders = (feedersOf.get(key) ?? []).map((f) => done.get(f));
    if (feeders.some((f) => !f)) {
      unscheduled.push({ bracket: item.bracket, draft: item.draft });
      continue;
    }
    const earliest = Math.max(0, ...feeders.map((f) => f!.endMs));
    const known = [item.draft.homeTeamId, item.draft.awayTeamId].filter(Boolean) as string[];
    let chosen: { slot: (typeof slots)[number]; field: string; dayCount: number } | null = null;
    for (const slot of slots) {
      if (new Date(slot.iso).getTime() < earliest) continue;
      const fromFeeders = Math.max(0, ...feeders.map((f) => (f!.day === slot.day ? f!.dayCount : 0)));
      const fromExisting = Math.max(0, ...known.map((t) => existingPerDay.get(`${t}|${slot.day}`) ?? 0));
      const dayCount = Math.max(fromFeeders, fromExisting) + 1;
      if (dayCount > opts.maxGamesPerTeamPerDay) continue;
      const used = fieldsUsed.get(slot.iso);
      const field = opts.fields.find((f) => !used?.has(f));
      if (!field) continue;
      chosen = { slot, field, dayCount };
      break;
    }
    if (!chosen) {
      unscheduled.push({ bracket: item.bracket, draft: item.draft });
      continue;
    }
    occupyField(chosen.slot.iso, chosen.field);
    done.set(key, { endMs: new Date(chosen.slot.iso).getTime() + gameMs, day: chosen.slot.day, dayCount: chosen.dayCount });
    placed.push({ bracket: item.bracket, draft: item.draft, field: chosen.field, startsAt: chosen.slot.iso, late: chosen.slot.late });
  }
  return { placed, unscheduled, usedLate: placed.some((p) => p.late) };
}
