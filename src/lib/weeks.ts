import type { EventWeek } from '../data/types';
import { formatDay, normalizeIsoDate } from './time';

/**
 * The week a director or family most likely wants: the one happening today,
 * otherwise the next upcoming week, otherwise the most recent past week.
 */
export function pickDefaultEvent<T extends Pick<EventWeek, 'id' | 'startsOn' | 'endsOn'>>(events: T[], today: string): T | null {
  if (events.length === 0) return null;
  const current = events.find((e) => e.startsOn <= today && today <= e.endsOn);
  if (current) return current;
  const upcoming = events.filter((e) => e.startsOn > today).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  if (upcoming.length) return upcoming[0];
  return [...events].sort((a, b) => b.endsOn.localeCompare(a.endsOn))[0];
}

export type WeekStatus = 'past' | 'current' | 'upcoming';

export function weekStatus(e: Pick<EventWeek, 'startsOn' | 'endsOn'>, today: string): WeekStatus {
  if (today < e.startsOn) return 'upcoming';
  if (today > e.endsOn) return 'past';
  return 'current';
}

/** "Jul 11 – Jul 17" */
export function weekRange(e: Pick<EventWeek, 'startsOn' | 'endsOn'>): string {
  const strip = (s: string) => s.replace(/^\w+, /, '');
  return `${strip(formatDay(e.startsOn))} – ${strip(formatDay(e.endsOn))}`;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface SeasonWeekDraft {
  name: string;
  startsOn: string;
  endsOn: string;
}

/**
 * Consecutive tournament weeks. Cooperstown runs 6-day weeks with no break
 * days, so weeks roll: the next week's Day 1 is the day after the last one's
 * Day 6, and Day 1 lands on a different weekday each week.
 */
export function generateSeasonWeeks(
  firstArrival: string,
  count: number,
  { daysPerWeek = 6, breakDays = 0, label = 'Week' }: { daysPerWeek?: number; breakDays?: number; label?: string } = {},
): SeasonWeekDraft[] {
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const startsOn = addDays(firstArrival, i * (daysPerWeek + breakDays));
    return { name: `${label} ${i + 1}`, startsOn, endsOn: addDays(startsOn, daysPerWeek - 1) };
  });
}

/**
 * Finds the week a registration belongs to from what the export tells us:
 * a program/session start date that falls inside a week wins, then a
 * "Week 7" number in the program name, then an exact name match.
 */
export function matchWeek<T extends Pick<EventWeek, 'id' | 'name' | 'startsOn' | 'endsOn'>>(
  events: T[],
  hint: { program?: string | null; startDate?: string | null },
): T | null {
  const date = normalizeIsoDate(hint.startDate ?? '') ?? findDateIn(hint.program ?? '');
  if (date) {
    const byDate = events.find((e) => e.startsOn <= date && date <= e.endsOn);
    if (byDate) return byDate;
  }
  const program = (hint.program ?? '').trim().toLowerCase();
  if (!program) return null;
  const num = program.match(/\bweek\s*#?\s*(\d{1,2})\b/)?.[1];
  if (num) {
    const byNumber = events.find((e) => e.name.toLowerCase().match(/\bweek\s*#?\s*(\d{1,2})\b/)?.[1] === num);
    if (byNumber) return byNumber;
  }
  return events.find((e) => e.name.trim().toLowerCase() === program) ?? null;
}

function findDateIn(text: string): string | null {
  const m = text.match(/(\d{4}-\d{1,2}-\d{1,2})|(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  return m ? normalizeIsoDate(m[0]) : null;
}
