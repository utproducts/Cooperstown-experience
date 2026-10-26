/**
 * Time helpers that work in the event's timezone (Cooperstown is
 * America/New_York) regardless of the device's own timezone.
 */

export const DEFAULT_TZ = 'America/New_York';

function partsInZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Offset of `timeZone` from UTC at `date`, in minutes (e.g. -240 for EDT). */
export function zoneOffsetMinutes(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Converts a wall-clock date ("2026-07-11") and time ("08:30") in `timeZone` to an ISO UTC string. */
export function zonedToIso(date: string, time: string, timeZone = DEFAULT_TZ): string {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes handle the rare case where the guess lands across a DST change.
  let offset = zoneOffsetMinutes(new Date(guess), timeZone);
  let ts = guess - offset * 60000;
  const offset2 = zoneOffsetMinutes(new Date(ts), timeZone);
  if (offset2 !== offset) {
    offset = offset2;
    ts = guess - offset * 60000;
  }
  return new Date(ts).toISOString();
}

/** "2026-07-11" for the given instant in `timeZone`. */
export function localDateKey(iso: string, timeZone = DEFAULT_TZ): string {
  const p = partsInZone(new Date(iso), timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** "08:30" for the given instant in `timeZone`. */
export function localTimeKey(iso: string, timeZone = DEFAULT_TZ): string {
  const p = partsInZone(new Date(iso), timeZone);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

/**
 * Short time zone label shown after every time ("ET" for Cooperstown). Families travel from other zones, so a time is
 * never shown without one.
 */
export function zoneLabel(timeZone = DEFAULT_TZ): string {
  if (timeZone === 'America/New_York') return 'ET';
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(new Date()).find((x) => x.type === 'timeZoneName');
  return part?.value ?? timeZone;
}

/** "8:00 AM ET" */
export function formatTime(iso: string, timeZone = DEFAULT_TZ): string {
  return `${new Date(iso).toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })} ${zoneLabel(timeZone)}`;
}

/** A wall-clock "HH:MM" (24-hour) as "8:00 AM"; "24:00" is midnight at the end of the day. */
export function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, '0')} ${h % 24 < 12 ? 'AM' : 'PM'}`;
}

export function formatDay(isoOrDate: string, timeZone = DEFAULT_TZ): string {
  const d = isoOrDate.length === 10 ? new Date(`${isoOrDate}T12:00:00Z`) : new Date(isoOrDate);
  return d.toLocaleDateString('en-US', {
    timeZone: isoOrDate.length === 10 ? 'UTC' : timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(iso: string, timeZone = DEFAULT_TZ): string {
  return `${formatDay(iso, timeZone)} · ${formatTime(iso, timeZone)}`;
}

/** Inclusive list of ISO dates between two ISO dates. */
export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (d <= last) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.round((now - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 60 * 24) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

/** Converts "3/14/2014", "2014-03-14" or "03-14-14" to an ISO date, or null. */
export function normalizeIsoDate(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s|$)/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return null;
}
