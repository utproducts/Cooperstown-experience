import { parseCsvObjects } from './csv';
import { normalizeIsoDate } from './time';

/**
 * Converts a registration export (LeagueApps "Registrations" / "Members"
 * export, or any similar spreadsheet) into teams, players and coaches.
 *
 * Column names vary between exports and between how a director customizes
 * their LeagueApps report, so each field is matched against a list of aliases
 * after normalizing case and punctuation.
 */

export type RegistrationField =
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'team'
  | 'teamId'
  | 'role'
  | 'jersey'
  | 'birthDate'
  | 'guardianFirst'
  | 'guardianLast'
  | 'guardianName'
  | 'guardianEmail'
  | 'guardianPhone'
  | 'email'
  | 'phone'
  | 'city'
  | 'state'
  | 'memberId'
  | 'status'
  | 'program'
  | 'programStart';

const ALIASES: Record<RegistrationField, string[]> = {
  firstName: ['first name', 'player first name', 'participant first name', 'member first name', 'athlete first name', 'first'],
  lastName: ['last name', 'player last name', 'participant last name', 'member last name', 'athlete last name', 'last'],
  fullName: ['name', 'player name', 'participant name', 'member name', 'athlete name', 'full name'],
  team: ['team', 'team name', 'assigned team', 'team assignment', 'roster'],
  teamId: ['team id', 'leagueapps team id', 'team number'],
  role: ['role', 'registration role', 'member type', 'type', 'participant type'],
  jersey: ['jersey', 'jersey number', 'jersey #', 'uniform number', 'number', '#'],
  birthDate: ['birth date', 'birthdate', 'date of birth', 'dob', 'birthday'],
  guardianFirst: ['parent 1 first name', 'parent first name', 'guardian first name', 'parent/guardian first name', 'parent 1 first'],
  guardianLast: ['parent 1 last name', 'parent last name', 'guardian last name', 'parent/guardian last name', 'parent 1 last'],
  guardianName: ['parent name', 'guardian name', 'parent/guardian name', 'parent 1 name', 'emergency contact name'],
  guardianEmail: ['parent 1 email', 'parent email', 'guardian email', 'parent/guardian email', 'account email', 'parent 1 email address', 'parent email address'],
  guardianPhone: ['parent 1 phone', 'parent phone', 'guardian phone', 'parent/guardian phone', 'parent 1 cell phone', 'parent cell', 'parent mobile'],
  email: ['email', 'email address', 'member email', 'player email', 'participant email'],
  phone: ['phone', 'phone number', 'cell phone', 'mobile phone', 'mobile'],
  city: ['city', 'team city', 'hometown'],
  state: ['state', 'team state', 'state/province', 'province'],
  memberId: ['member id', 'user id', 'leagueapps user id', 'player id', 'registration id', 'participant id'],
  status: ['registration status', 'status', 'payment status'],
  program: ['program', 'program name', 'session', 'session name', 'season', 'season name', 'event', 'event name', 'tournament week', 'week'],
  programStart: ['program start date', 'session start date', 'season start date', 'event start date', 'start date', 'week start date', 'arrival date'],
};

export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[_\-.:]+/g, ' ')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type ColumnMapping = Partial<Record<RegistrationField, string>>;

export function detectColumns(headers: string[]): ColumnMapping {
  const byNorm = new Map(headers.map((h) => [normalizeHeader(h), h]));
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  // Specific fields first so e.g. "Parent 1 Email" isn't claimed as "Email".
  const order: RegistrationField[] = [
    'guardianFirst', 'guardianLast', 'guardianName', 'guardianEmail', 'guardianPhone',
    'programStart', 'program', 'teamId', 'team', 'firstName', 'lastName', 'fullName', 'role', 'jersey', 'birthDate',
    'email', 'phone', 'city', 'state', 'memberId', 'status',
  ];
  for (const field of order) {
    for (const alias of ALIASES[field]) {
      const original = byNorm.get(alias);
      if (original && !used.has(original)) {
        mapping[field] = original;
        used.add(original);
        break;
      }
    }
  }
  return mapping;
}

export interface ImportedPlayer {
  firstName: string;
  lastName: string;
  jerseyNumber: string | null;
  birthDate: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  externalId: string | null;
}

export interface ImportedTeam {
  key: string;
  /** Program / session from the export (e.g. "Week 7 - 12U"), used to pick the tournament week. */
  program: string | null;
  programStartDate: string | null;
  name: string;
  city: string;
  state: string;
  externalId: string | null;
  coachName: string | null;
  coachEmail: string | null;
  coachPhone: string | null;
  players: ImportedPlayer[];
}

export interface ImportIssue {
  row: number;
  message: string;
}

export interface ImportResult {
  teams: ImportedTeam[];
  issues: ImportIssue[];
  mapping: ColumnMapping;
  rowCount: number;
  skipped: number;
}

const INACTIVE_STATUS = /cancel|withdraw|refund|declin|inactive|waitlist/i;
const COACH_ROLE = /coach|manager|staff/i;

function nullIfEmpty(v: string | undefined): string | null {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
}

function cleanEmail(v: string | undefined): string | null {
  const t = nullIfEmpty(v)?.toLowerCase() ?? null;
  return t && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : null;
}

export function normalizeDate(v: string | undefined): string | null {
  return normalizeIsoDate(nullIfEmpty(v) ?? '');
}

function splitName(full: string): [string, string] {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return [parts[0], ''];
  return [parts.slice(0, -1).join(' '), parts[parts.length - 1]];
}

/** Pulls "City, ST" out of team names like "Tampa Bay Rays 12U (Tampa, FL)". */
function cityStateFromTeamName(name: string): { city: string; state: string } {
  const m = name.match(/\(([^,()]+),\s*([A-Za-z]{2})\)/);
  return m ? { city: m[1].trim(), state: m[2].toUpperCase() } : { city: '', state: '' };
}

export function parseRegistrations(csv: string, override?: ColumnMapping): ImportResult {
  const { headers, records } = parseCsvObjects(csv);
  const mapping = { ...detectColumns(headers), ...override };
  const issues: ImportIssue[] = [];
  const teams = new Map<string, ImportedTeam>();
  let skipped = 0;

  if (!mapping.team && !mapping.teamId) {
    issues.push({ row: 1, message: 'No team column found. Add a "Team" column or map one manually.' });
  }
  if (!mapping.firstName && !mapping.fullName) {
    issues.push({ row: 1, message: 'No player name column found ("First Name"/"Last Name" or "Name").' });
  }

  const get = (rec: Record<string, string>, f: RegistrationField) => (mapping[f] ? rec[mapping[f]!] : undefined);

  records.forEach((rec, idx) => {
    const rowNum = idx + 2; // header is row 1
    const status = get(rec, 'status');
    if (status && INACTIVE_STATUS.test(status)) {
      skipped++;
      return;
    }
    const teamName = nullIfEmpty(get(rec, 'team'));
    const teamExt = nullIfEmpty(get(rec, 'teamId'));
    if (!teamName && !teamExt) {
      issues.push({ row: rowNum, message: 'Missing team; row skipped.' });
      skipped++;
      return;
    }
    const program = nullIfEmpty(get(rec, 'program'));
    const programStartDate = normalizeDate(get(rec, 'programStart'));
    // The same club can come to Cooperstown in two different weeks; keep those apart.
    const key = `${program ?? ''}|${programStartDate ?? ''}|${(teamExt ?? teamName!).toLowerCase()}`;
    let team = teams.get(key);
    if (!team) {
      const fromName = cityStateFromTeamName(teamName ?? '');
      team = {
        key,
        program,
        programStartDate,
        name: (teamName ?? `Team ${teamExt}`).replace(/\s*\([^)]*\)\s*$/, '').trim(),
        city: nullIfEmpty(get(rec, 'city')) ?? fromName.city,
        state: (nullIfEmpty(get(rec, 'state')) ?? fromName.state).toUpperCase(),
        externalId: teamExt,
        coachName: null,
        coachEmail: null,
        coachPhone: null,
        players: [],
      };
      teams.set(key, team);
    }

    let first = nullIfEmpty(get(rec, 'firstName'));
    let last = nullIfEmpty(get(rec, 'lastName'));
    if (!first && mapping.fullName) {
      const full = nullIfEmpty(get(rec, 'fullName'));
      if (full) [first, last] = splitName(full);
    }
    if (!first) {
      issues.push({ row: rowNum, message: 'Missing name; row skipped.' });
      skipped++;
      return;
    }

    const role = get(rec, 'role') ?? '';
    if (COACH_ROLE.test(role)) {
      if (!team.coachName) {
        team.coachName = [first, last].filter(Boolean).join(' ');
        team.coachEmail = cleanEmail(get(rec, 'email')) ?? cleanEmail(get(rec, 'guardianEmail'));
        team.coachPhone = nullIfEmpty(get(rec, 'phone'));
      }
      return;
    }

    const guardianName =
      nullIfEmpty(get(rec, 'guardianName')) ??
      (nullIfEmpty([get(rec, 'guardianFirst'), get(rec, 'guardianLast')].filter(Boolean).join(' ')));
    const guardianEmail = cleanEmail(get(rec, 'guardianEmail')) ?? cleanEmail(get(rec, 'email'));
    if (!guardianEmail) {
      issues.push({ row: rowNum, message: `${first} ${last ?? ''}: no valid parent email, invite can't be sent.`.replace(' :', ':') });
    }

    team.players.push({
      firstName: first,
      lastName: last ?? '',
      jerseyNumber: nullIfEmpty(get(rec, 'jersey')),
      birthDate: normalizeDate(get(rec, 'birthDate')),
      guardianName,
      guardianEmail,
      guardianPhone: nullIfEmpty(get(rec, 'guardianPhone')) ?? nullIfEmpty(get(rec, 'phone')),
      externalId: nullIfEmpty(get(rec, 'memberId')),
    });
  });

  return {
    teams: [...teams.values()].sort((a, b) => a.name.localeCompare(b.name)),
    issues,
    mapping,
    rowCount: records.length,
    skipped,
  };
}
