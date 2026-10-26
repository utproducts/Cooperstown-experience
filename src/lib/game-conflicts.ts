import type { Game } from '../data/types';
import { localDateKey } from './time';

/** The same rules the schedule builder uses (lib/week-schedule.ts), checked for one game being moved or changed. */
export interface ConflictRules {
  slotMinutes: number;
  /** Empty slots a team gets between games on the same day. */
  restSlots: number;
  maxPerDay: number;
  timeZone: string;
}

export const DEFAULT_RULES: ConflictRules = { slotMinutes: 120, restSlots: 1, maxPerDay: 3, timeZone: 'America/New_York' };

export interface Conflict {
  kind: 'same-team' | 'field' | 'team' | 'rest' | 'per-day';
  message: string;
  /** The other game involved, when there is one. */
  game?: Game;
}

export interface Proposal {
  startsAt: string;
  field: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
}

const live = (g: Game) => g.status !== 'cancelled' && g.status !== 'postponed';

/**
 * Problems with putting `game` at `p` (time, field, teams) given the rest of the week's games. Warnings, not
 * blocks: a director may knowingly double up a field or squeeze a game in, but should see it first.
 */
export function findConflicts(game: Game, p: Proposal, all: Game[], rules: ConflictRules = DEFAULT_RULES, teamName: (id: string) => string = (id) => id): Conflict[] {
  const out: Conflict[] = [];
  const slot = rules.slotMinutes * 60000;
  const start = new Date(p.startsAt).getTime();
  const day = localDateKey(p.startsAt, rules.timeZone);
  const others = all.filter((g) => g.id !== game.id && live(g));
  const overlaps = (g: Game) => Math.abs(new Date(g.startsAt).getTime() - start) < slot;

  if (p.homeTeamId && p.homeTeamId === p.awayTeamId) out.push({ kind: 'same-team', message: 'A team can’t play itself.' });

  for (const g of others.filter((g) => g.field === p.field && overlaps(g))) {
    out.push({ kind: 'field', game: g, message: `${p.field} already has G${g.number} then.` });
  }

  for (const t of [p.homeTeamId, p.awayTeamId].filter(Boolean) as string[]) {
    const theirs = others.filter((g) => g.homeTeamId === t || g.awayTeamId === t);
    for (const g of theirs.filter(overlaps)) out.push({ kind: 'team', game: g, message: `${teamName(t)} is already playing G${g.number} then.` });
    const sameDay = theirs.filter((g) => localDateKey(g.startsAt, rules.timeZone) === day);
    for (const g of sameDay.filter((g) => !overlaps(g) && Math.abs(new Date(g.startsAt).getTime() - start) < slot * (rules.restSlots + 1))) {
      out.push({ kind: 'rest', game: g, message: `${teamName(t)} plays G${g.number} right before or after, with no rest slot.` });
    }
    if (sameDay.length + 1 > rules.maxPerDay) out.push({ kind: 'per-day', message: `${teamName(t)} would play ${sameDay.length + 1} games that day (limit ${rules.maxPerDay}).` });
  }
  return out;
}
