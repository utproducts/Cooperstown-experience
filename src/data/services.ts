import { generateTeamCode, randomToken } from '../lib/codes';
import type { ImportedTeam } from '../lib/registrations';
import { bracketAdvance, overallSeeds, shiftGames } from '../lib/schedule';
import { planWeek, type WeekPlan, type WeekSettings } from '../lib/week-schedule';
import { formatDateTime, formatTime, zonedToIso } from '../lib/time';
import type { Backend } from './backend';
import type { AppNotification, EventWeek, Game, NotificationKind, Team } from './types';

/**
 * Director workflows built on top of the generic backend. Anything that
 * changes a team's schedule also posts a notification to that team's
 * followers (the server turns notification rows into push messages).
 */

export async function notify(
  backend: Backend,
  eventId: string,
  n: { kind: NotificationKind; title: string; body: string; teamIds?: string[] },
): Promise<AppNotification> {
  const [created] = await backend.insert('notifications', [
    {
      eventId,
      kind: n.kind,
      title: n.title,
      body: n.body,
      teamIds: n.teamIds ?? [],
      createdAt: new Date().toISOString(),
      createdBy: backend.currentProfile()?.id ?? null,
    },
  ]);
  return created;
}

export interface ImportSummary {
  teamsCreated: number;
  teamsUpdated: number;
  playersCreated: number;
  invitesCreated: number;
  invitesSent: number;
}

/**
 * Creates teams (with follow codes), players (with check-in tokens) and one
 * invite per parent email. Teams already in the event (same LeagueApps id or
 * same name) get new players appended rather than duplicated.
 */
export async function importRegistrations(
  backend: Backend,
  eventId: string,
  teams: ImportedTeam[],
  opts: { sendInvites: boolean },
): Promise<ImportSummary> {
  const existingTeams = await backend.select('teams', { eq: { eventId } });
  const existingPlayers = await backend.select('players');
  const existingInvites = await backend.select('invites');
  const taken = new Set(existingTeams.map((t) => t.code).filter(Boolean) as string[]);
  const summary: ImportSummary = { teamsCreated: 0, teamsUpdated: 0, playersCreated: 0, invitesCreated: 0, invitesSent: 0 };
  const newInviteIds: string[] = [];

  for (const it of teams) {
    let team: Team | undefined = existingTeams.find(
      (t) => (it.externalId && t.externalId === it.externalId) || t.name.toLowerCase() === it.name.toLowerCase(),
    );
    if (team) {
      summary.teamsUpdated++;
      const patch: Partial<Team> = {};
      if (!team.coachName && it.coachName) Object.assign(patch, { coachName: it.coachName, coachEmail: it.coachEmail, coachPhone: it.coachPhone });
      if (!team.organization && it.organization) patch.organization = it.organization;
      if (it.rosterSize !== null && team.rosterSize !== it.rosterSize) patch.rosterSize = it.rosterSize;
      if (Object.keys(patch).length) await backend.update('teams', team.id, patch);
    } else {
      [team] = await backend.insert('teams', [
        {
          eventId,
          name: it.name,
          city: it.city,
          state: it.state,
          organization: it.organization,
          rosterSize: it.rosterSize,
          code: generateTeamCode(it.name, taken),
          pool: null,
          coachName: it.coachName,
          coachEmail: it.coachEmail,
          coachPhone: it.coachPhone,
          externalId: it.externalId,
        },
      ]);
      summary.teamsCreated++;
    }

    const roster = existingPlayers.filter((p) => p.teamId === team!.id);
    const fresh = it.players.filter(
      (p) =>
        !roster.some(
          (r) =>
            (p.externalId && r.externalId === p.externalId) ||
            (r.firstName.toLowerCase() === p.firstName.toLowerCase() && r.lastName.toLowerCase() === p.lastName.toLowerCase()),
        ),
    );
    if (fresh.length) {
      await backend.insert(
        'players',
        fresh.map((p) => ({ ...p, teamId: team!.id, checkInToken: randomToken(16), checkedInAt: null, checkedInBy: null })),
      );
      summary.playersCreated += fresh.length;
    }

    const emails = new Map<string, string | null>();
    for (const p of it.players) if (p.guardianEmail) emails.set(p.guardianEmail, p.guardianName);
    if (it.coachEmail) emails.set(it.coachEmail, it.coachName);
    const toInvite = [...emails].filter(([email]) => !existingInvites.some((i) => i.teamId === team!.id && i.email === email));
    if (toInvite.length) {
      const created = await backend.insert(
        'invites',
        toInvite.map(([email, name]) => ({ teamId: team!.id, email, name, sentAt: null })),
      );
      summary.invitesCreated += created.length;
      newInviteIds.push(...created.map((c) => c.id));
    }
  }

  if (opts.sendInvites && newInviteIds.length) summary.invitesSent = await backend.sendInvites(newInviteIds);
  return summary;
}

export type WeekBuildSettings = WeekSettings;

/**
 * Runs the schedule engine for an event's teams. Pure: nothing is saved.
 * The engine's seeded shuffle depends on team order, so teams are put in the
 * registration export's order (A–Z, ignoring case) first: the same teams
 * always give the same schedule, however they were loaded.
 */
export function planEventWeek(teams: Team[], settings: WeekBuildSettings): WeekPlan {
  const key = (t: Team) => t.name.toLowerCase();
  const ordered = [...teams].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  return planWeek(
    ordered.map((t) => ({ id: t.id, name: t.name, club: t.organization ?? '', state: t.state })),
    settings,
  );
}

export type PlannedGameRow = Omit<Game, 'id'> & { key: string; winnerToKey: string | null };

/** Turns an engine plan into game rows (numbered in play order), with winner links as engine keys. Pure. */
export function planToGameRows(plan: WeekPlan, eventId: string, timeZone: string): PlannedGameRow[] {
  const ordered = [...plan.games].sort((a, b) => a.slot.index - b.slot.index || a.field.localeCompare(b.field, undefined, { numeric: true }));
  const numberOf = new Map(ordered.map((g, i) => [g.key, i + 1]));
  const winnerTo = new Map<string, { key: string; slot: 'home' | 'away' }>();
  for (const g of ordered) {
    if (g.homeFrom.startsWith('winner:')) winnerTo.set(g.homeFrom.slice(7), { key: g.key, slot: 'home' });
    if (g.awayFrom.startsWith('winner:')) winnerTo.set(g.awayFrom.slice(7), { key: g.key, slot: 'away' });
  }
  const side = (from: string) => {
    if (from.startsWith('seed:')) {
      const n = Number(from.slice(5));
      return { seed: n, label: `Seed #${n}` };
    }
    if (from.startsWith('winner:')) return { seed: null, label: `Winner G${numberOf.get(from.slice(7))}` };
    return { seed: null, label: null };
  };
  return ordered.map((g) => {
    const home = side(g.homeFrom);
    const away = side(g.awayFrom);
    const link = winnerTo.get(g.key);
    return {
      key: g.key,
      winnerToKey: link?.key ?? null,
      eventId,
      field: g.field,
      startsAt: zonedToIso(g.slot.date, g.slot.time, timeZone),
      homeTeamId: g.home,
      awayTeamId: g.away,
      homeLabel: home.label,
      awayLabel: away.label,
      homeSeed: home.seed,
      awaySeed: away.seed,
      homeScore: null,
      awayScore: null,
      status: 'scheduled',
      stage: g.stage,
      bracket: g.bracket ?? null,
      round: g.stage === 'pool' ? 'Pool play' : g.bracket ? g.label.slice(g.bracket.length).trim() : g.label,
      number: numberOf.get(g.key)!,
      winnerToGameId: null,
      winnerToSlot: link?.slot ?? null,
      note: null,
      baseballsUsed: null,
    };
  });
}

/**
 * Saves a whole week's schedule from the engine, replacing the event's games:
 * pool games with their teams, bracket games with "Seed #N" / "Winner G#"
 * placeholders that fill in as pool play ends and winners advance.
 */
export async function postWeekSchedule(backend: Backend, event: EventWeek, plan: WeekPlan): Promise<{ pool: number; bracket: number }> {
  const blocking = plan.problems.filter((p) => !p.startsWith('An odd number'));
  if (blocking.length) throw new Error(blocking[0]);
  const old = await backend.select('games', { eq: { eventId: event.id } });
  // Same rule as the Cooperstown admin site: once a game has a score, the week isn't rebuilt.
  if (old.some((g) => g.status === 'final')) {
    throw new Error('This week has scores, so its schedule can’t be built again. Change games one at a time on the Games tab.');
  }
  await backend.remove('games', old.map((g) => g.id));

  const rows = planToGameRows(plan, event.id, event.timezone);
  // Insert with the engine key in `note`, then turn keys into winner links once the games have ids.
  const created = await backend.insert(
    'games',
    rows.map(({ key, winnerToKey: _w, ...row }) => ({ ...row, winnerToSlot: null, note: key })),
  );
  const idByKey = new Map(created.map((c) => [c.note!, c.id]));
  for (const r of rows) {
    await backend.update('games', idByKey.get(r.key)!, {
      note: null,
      winnerToGameId: r.winnerToKey ? idByKey.get(r.winnerToKey)! : null,
      winnerToSlot: r.winnerToSlot,
    });
  }
  return { pool: created.filter((c) => c.stage === 'pool').length, bracket: created.filter((c) => c.stage === 'bracket').length };
}

/**
 * After pool play: ranks every team (Cooperstown standings order), puts each
 * seed into its bracket games, and tells every team which bracket they're in.
 */
export async function seedBrackets(backend: Backend, event: EventWeek, teams: Team[], games: Game[]): Promise<{ seeded: number }> {
  const open = games.filter((g) => g.stage === 'pool' && g.status !== 'final' && g.status !== 'cancelled').length;
  if (open) throw new Error(`${open} pool game${open === 1 ? ' still needs a' : 's still need'} score. Seed the brackets when pool play is over.`);
  if (games.some((g) => g.stage === 'bracket' && g.status === 'final')) throw new Error('The brackets have started, so the seeds can’t change.');
  const seeds = overallSeeds(teams, games);
  const bracketGames = games.filter((g) => g.stage === 'bracket');
  const membership = new Map<string, Set<string>>();
  let seeded = 0;
  for (const g of bracketGames) {
    const patch: Partial<Game> = {};
    if (g.homeSeed) patch.homeTeamId = seeds[g.homeSeed - 1] ?? null;
    if (g.awaySeed) patch.awayTeamId = seeds[g.awaySeed - 1] ?? null;
    if (Object.keys(patch).length === 0) continue;
    await backend.update('games', g.id, patch);
    for (const id of [patch.homeTeamId, patch.awayTeamId]) {
      if (!id || !g.bracket) continue;
      if (!membership.has(g.bracket)) membership.set(g.bracket, new Set());
      membership.get(g.bracket)!.add(id);
      seeded++;
    }
  }
  for (const [bracket, ids] of membership) {
    await notify(backend, event.id, {
      kind: 'schedule',
      title: `Bracket play: you're in the ${bracket} bracket`,
      body: `Seeds are set from pool play. Check the schedule for your first ${bracket} bracket game.`,
      teamIds: [...ids],
    });
  }
  return { seeded };
}

function teamName(teams: Team[], id: string | null, fallback: string | null) {
  return teams.find((t) => t.id === id)?.name ?? fallback ?? 'TBD';
}

/** Saves a score. Going final notifies both teams and advances bracket winners. */
export async function saveScore(
  backend: Backend,
  game: Game,
  teams: Team[],
  homeScore: number | null,
  awayScore: number | null,
  status: Game['status'],
  baseballsUsed: number | null = game.baseballsUsed,
) {
  await backend.update('games', game.id, { homeScore, awayScore, status, baseballsUsed });
  const updated = { ...game, homeScore, awayScore, status, baseballsUsed };
  if (status === 'final' && game.status !== 'final' && homeScore !== null && awayScore !== null) {
    const home = teamName(teams, game.homeTeamId, game.homeLabel);
    const away = teamName(teams, game.awayTeamId, game.awayLabel);
    await notify(backend, game.eventId, {
      kind: 'score',
      title: `Final: ${away} ${awayScore}, ${home} ${homeScore}`,
      body: `G${game.number} on ${game.field}${game.bracket ? ` · ${game.bracket} bracket` : ''}${game.round ? ` · ${game.round}` : ''}`,
      teamIds: [game.homeTeamId, game.awayTeamId].filter(Boolean) as string[],
    });
    const adv = bracketAdvance(updated);
    if (adv) await backend.update('games', adv.gameId, adv.patch);
  }
}

/** Clears a score back to scheduled (e.g. entered on the wrong game). */
export async function clearScore(backend: Backend, game: Game) {
  await backend.update('games', game.id, { homeScore: null, awayScore: null, status: 'scheduled' });
  if (game.stage === 'bracket' && game.winnerToGameId && game.status === 'final') {
    // undo the advancement into the next game
    await backend.update('games', game.winnerToGameId, game.winnerToSlot === 'home' ? { homeTeamId: null } : { awayTeamId: null });
  }
}

/** Delays (or moves earlier, with negative minutes) games and notifies every affected team. */
export async function delayGames(
  backend: Backend,
  event: EventWeek,
  allGames: Game[],
  teams: Team[],
  targetIds: string[],
  minutes: number,
  opts: { cascade: boolean; reason: string },
) {
  const res = shiftGames(allGames, targetIds, minutes, { cascade: opts.cascade, timeZone: event.timezone });
  for (const c of res.changes) {
    const g = allGames.find((x) => x.id === c.id)!;
    await backend.update('games', c.id, {
      startsAt: c.startsAt,
      status: g.status === 'scheduled' && minutes > 0 ? 'delayed' : g.status,
      note: opts.reason || g.note,
    });
  }
  // One notification per team so each family sees their own new time.
  for (const teamId of res.affectedTeamIds) {
    const mine = res.changes
      .map((c) => ({ c, g: allGames.find((x) => x.id === c.id)! }))
      .filter(({ g }) => g.homeTeamId === teamId || g.awayTeamId === teamId);
    const lines = mine.map(({ c, g }) => {
      const opp = g.homeTeamId === teamId ? teamName(teams, g.awayTeamId, g.awayLabel) : teamName(teams, g.homeTeamId, g.homeLabel);
      return `vs ${opp} now ${formatTime(c.startsAt, event.timezone)} (was ${formatTime(g.startsAt, event.timezone)}) on ${g.field}`;
    });
    await notify(backend, event.id, {
      kind: 'schedule',
      title: minutes > 0 ? `Game delayed ${minutes} min` : `Game time changed`,
      body: [opts.reason, ...lines].filter(Boolean).join('\n'),
      teamIds: [teamId],
    });
  }
  return res;
}

/** Moves a single game to a new time and/or field and notifies both teams. */
export async function rescheduleGame(
  backend: Backend,
  event: EventWeek,
  game: Game,
  teams: Team[],
  patch: { startsAt: string; field: string },
  reason: string,
) {
  await backend.update('games', game.id, { ...patch, note: reason || game.note });
  const ids = [game.homeTeamId, game.awayTeamId].filter(Boolean) as string[];
  if (ids.length && (patch.startsAt !== game.startsAt || patch.field !== game.field)) {
    await notify(backend, event.id, {
      kind: 'schedule',
      title: `G${game.number} rescheduled`,
      body: `${teamName(teams, game.awayTeamId, game.awayLabel)} at ${teamName(teams, game.homeTeamId, game.homeLabel)} is now ${formatDateTime(patch.startsAt, event.timezone)} on ${patch.field}.${reason ? `\n${reason}` : ''}`,
      teamIds: ids,
    });
  }
}

/** Trades two games' times and fields (e.g. to fix a double-booked field). Both games' teams are notified. */
export async function swapGames(backend: Backend, event: EventWeek, a: Game, b: Game, teams: Team[], reason: string) {
  await rescheduleGame(backend, event, a, teams, { startsAt: b.startsAt, field: b.field }, reason);
  await rescheduleGame(backend, event, b, teams, { startsAt: a.startsAt, field: a.field }, reason);
}

/** Changes who plays in a game. Every team added or taken off it is told. */
export async function changeGameTeams(
  backend: Backend,
  event: EventWeek,
  game: Game,
  teams: Team[],
  next: { homeTeamId: string | null; awayTeamId: string | null },
  reason: string,
) {
  if (game.status === 'final') throw new Error('This game has a final score. Remove the score first, then change the teams.');
  if (next.homeTeamId && next.homeTeamId === next.awayTeamId) throw new Error('A team can’t play itself.');
  await backend.update('games', game.id, { homeTeamId: next.homeTeamId, awayTeamId: next.awayTeamId });
  const ids = [...new Set([game.homeTeamId, game.awayTeamId, next.homeTeamId, next.awayTeamId].filter(Boolean) as string[])];
  if (!ids.length) return;
  await notify(backend, event.id, {
    kind: 'schedule',
    title: `G${game.number} matchup changed`,
    body: `G${game.number} is now ${teamName(teams, next.awayTeamId, game.awayLabel)} at ${teamName(teams, next.homeTeamId, game.homeLabel)}, ${formatDateTime(game.startsAt, event.timezone)} on ${game.field}.${reason ? `\n${reason}` : ''}`,
    teamIds: ids,
  });
}
