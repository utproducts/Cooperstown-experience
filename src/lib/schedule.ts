import type { Game, Team } from '../data/types';
import { addMinutes, localDateKey, DEFAULT_TZ } from './time';

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
 * Pool standings, Cooperstown order: win % (a tie counts half), then head to
 * head (only when exactly two teams are tied), fewest runs allowed, run
 * differential (at most `runDiffCap` a game), most runs scored. Teams without
 * a pool are ranked together.
 */
export function computeStandings(
  teams: Pick<Team, 'id' | 'pool'>[],
  games: Game[],
  runDiffCap = 8,
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const t of teams) {
    rows.set(t.id, { teamId: t.id, pool: t.pool ?? 'All', wins: 0, losses: 0, ties: 0, runsFor: 0, runsAgainst: 0, runDiff: 0, played: 0 });
  }
  const finals = games.filter(
    (g) => g.stage === 'pool' && g.status === 'final' && g.homeScore !== null && g.awayScore !== null && g.homeTeamId && g.awayTeamId,
  );
  for (const g of finals) {
    const home = rows.get(g.homeTeamId!);
    const away = rows.get(g.awayTeamId!);
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
    apply(home, g.homeScore!, g.awayScore!);
    apply(away, g.awayScore!, g.homeScore!);
  }
  const pct = (r: StandingRow) => (r.played === 0 ? 0 : (r.wins + r.ties * 0.5) / r.played);
  // +1 when x beat y more often than not, -1 the other way.
  const headToHead = (x: StandingRow, y: StandingRow) =>
    Math.sign(
      finals.reduce((n, g) => {
        const ids = [g.homeTeamId, g.awayTeamId];
        if (!ids.includes(x.teamId) || !ids.includes(y.teamId)) return n;
        const xs = g.homeTeamId === x.teamId ? g.homeScore! : g.awayScore!;
        const ys = g.homeTeamId === y.teamId ? g.homeScore! : g.awayScore!;
        return n + Math.sign(xs - ys);
      }, 0),
    );
  const list = [...rows.values()];
  return list.sort((a, b) => {
    if (a.pool !== b.pool) return a.pool.localeCompare(b.pool);
    if (pct(b) !== pct(a)) return pct(b) - pct(a);
    if (list.filter((r) => r.pool === a.pool && pct(r) === pct(a)).length === 2) {
      const h = headToHead(a, b);
      if (h) return -h;
    }
    return a.runsAgainst - b.runsAgainst || b.runDiff - a.runDiff || b.runsFor - a.runsFor;
  });
}

/** Overall seeds for the brackets (best first): every team ranked together by the standings order. */
export function overallSeeds(teams: Pick<Team, 'id'>[], games: Game[]): string[] {
  return computeStandings(
    teams.map((t) => ({ id: t.id, pool: null })),
    games,
  ).map((r) => r.teamId);
}

// ---------------------------------------------------------------------------
// Bracket

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

/** "Field 1" … "Field n" */
export function fieldNames(count: number): string[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => `Field ${i + 1}`);
}
