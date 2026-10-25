import { generateTeamCode, randomToken } from '../lib/codes';
import type { ImportedTeam } from '../lib/registrations';
import {
  assignPools,
  bracketAdvance,
  buildBracket,
  buildPoolMatchups,
  placeMatchups,
  shiftGames,
  type ScheduleOptions,
  type SlotGrid,
} from '../lib/schedule';
import { formatDateTime, formatTime } from '../lib/time';
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
      if (Object.keys(patch).length) await backend.update('teams', team.id, patch);
    } else {
      [team] = await backend.insert('teams', [
        {
          eventId,
          name: it.name,
          city: it.city,
          state: it.state,
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

export async function setPools(backend: Backend, teams: Team[], poolCount: number) {
  const pools = assignPools(teams, poolCount);
  for (const t of teams) {
    const pool = pools.get(t.id)!;
    if (t.pool !== pool) await backend.update('teams', t.id, { pool });
  }
}

async function nextGameNumber(backend: Backend, eventId: string) {
  const games = await backend.select('games', { eq: { eventId } });
  return games.reduce((m, g) => Math.max(m, g.number), 0) + 1;
}

/** Generates and saves pool play. Returns how many matchups could not be placed. */
export async function generatePoolPlay(
  backend: Backend,
  event: EventWeek,
  teams: Team[],
  gamesPerTeam: number,
  grid: SlotGrid,
  opts: ScheduleOptions,
  { replaceExisting }: { replaceExisting: boolean },
): Promise<{ created: number; unscheduled: number }> {
  if (replaceExisting) {
    const old = await backend.select('games', { eq: { eventId: event.id, stage: 'pool' } });
    await backend.remove('games', old.map((g) => g.id));
  }
  const res = placeMatchups(buildPoolMatchups(teams, gamesPerTeam), { ...grid, timeZone: event.timezone }, opts);
  let n = await nextGameNumber(backend, event.id);
  const rows: Partial<Game>[] = res.scheduled
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.field.localeCompare(b.field))
    .map((m) => ({
      eventId: event.id,
      field: m.field,
      startsAt: m.startsAt,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeLabel: null,
      awayLabel: null,
      homeScore: null,
      awayScore: null,
      status: 'scheduled',
      stage: 'pool',
      round: `Pool ${m.pool}`,
      number: n++,
      winnerToGameId: null,
      winnerToSlot: null,
      note: null,
    }));
  await backend.insert('games', rows);
  return { created: rows.length, unscheduled: res.unscheduled.length };
}

/**
 * Creates a single-elimination bracket from seeds. Each round is placed at the
 * next start time, spread across fields.
 */
export async function generateBracket(
  backend: Backend,
  event: EventWeek,
  seededTeamIds: string[],
  roundStarts: string[],
  fields: string[],
): Promise<number> {
  const drafts = buildBracket(seededTeamIds);
  if (drafts.length === 0) return 0;
  const old = await backend.select('games', { eq: { eventId: event.id, stage: 'bracket' } });
  await backend.remove('games', old.map((g) => g.id));

  let n = await nextGameNumber(backend, event.id);
  const numberByKey = new Map<string, number>();
  const rounds = [...new Set(drafts.map((d) => d.round))].sort((a, b) => a - b);
  const rows: Partial<Game>[] = [];
  for (const round of rounds) {
    const inRound = drafts.filter((d) => d.round === round);
    inRound.forEach((d, i) => {
      numberByKey.set(d.key, n);
      const startsAt = roundStarts[Math.min(round - 1, roundStarts.length - 1)];
      const relabel = (l: string | null) => (l?.startsWith('Winner ') ? `Winner G${numberByKey.get(l.slice(7))}` : l);
      rows.push({
        eventId: event.id,
        field: fields[i % fields.length],
        startsAt,
        homeTeamId: d.homeTeamId,
        awayTeamId: d.awayTeamId,
        homeLabel: relabel(d.homeLabel),
        awayLabel: relabel(d.awayLabel),
        homeScore: null,
        awayScore: null,
        status: 'scheduled',
        stage: 'bracket',
        round: d.roundName,
        number: n++,
        winnerToGameId: null,
        winnerToSlot: null,
        note: d.key, // temporary, replaced with links below
      });
    });
  }
  const created = await backend.insert('games', rows);
  const idByKey = new Map(created.map((g) => [g.note!, g.id]));
  for (const d of drafts) {
    const id = idByKey.get(d.key)!;
    await backend.update('games', id, {
      note: null,
      winnerToGameId: d.winnerTo ? idByKey.get(d.winnerTo.key)! : null,
      winnerToSlot: d.winnerTo?.slot ?? null,
    });
  }
  await notify(backend, event.id, {
    kind: 'schedule',
    title: 'Bracket is set!',
    body: 'Championship bracket games are now posted. Check the schedule for your first bracket game.',
    teamIds: seededTeamIds,
  });
  return created.length;
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
) {
  await backend.update('games', game.id, { homeScore, awayScore, status });
  const updated = { ...game, homeScore, awayScore, status };
  if (status === 'final' && game.status !== 'final' && homeScore !== null && awayScore !== null) {
    const home = teamName(teams, game.homeTeamId, game.homeLabel);
    const away = teamName(teams, game.awayTeamId, game.awayLabel);
    await notify(backend, game.eventId, {
      kind: 'score',
      title: `Final: ${away} ${awayScore}, ${home} ${homeScore}`,
      body: `G${game.number} on ${game.field}${game.round ? ` · ${game.round}` : ''}`,
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
