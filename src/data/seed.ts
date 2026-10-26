import { teamPrefix } from '../lib/codes';
import { fieldNames } from '../lib/schedule';
import { planWeek } from '../lib/week-schedule';
import { generateSeasonWeeks } from '../lib/weeks';
import { addMinutes, DEFAULT_TZ, zonedToIso, localDateKey } from '../lib/time';
import type { Tables } from './backend';
import { planToGameRows } from './services';
import type { Game, Player, Team } from './types';
import { WEEK1_2027_START, WEEK1_2027_TEAMS } from './week1-2027';

/**
 * Sample data for demo mode. Dates are relative to "now" so the demo always
 * shows a week in progress: arrival was yesterday, pool play is under way.
 */

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const TEAMS: [string, string, string][] = [
  ['Gulf Coast Storm', 'Tampa', 'FL'],
  ['Lake Forest Thunder', 'Lake Forest', 'IL'],
  ['Hill Country Outlaws', 'Austin', 'TX'],
  ['Bayou Bombers', 'Baton Rouge', 'LA'],
  ['Mile High Miners', 'Denver', 'CO'],
  ['Cape Cod Clippers', 'Barnstable', 'MA'],
  ['Desert Dawgs', 'Scottsdale', 'AZ'],
  ['Carolina Riptide', 'Wilmington', 'NC'],
  ['Hoosier Hammers', 'Carmel', 'IN'],
  ['Bluegrass Bats', 'Lexington', 'KY'],
  ['Puget Sound Orcas', 'Tacoma', 'WA'],
  ['Garden State Gators', 'Toms River', 'NJ'],
  ['Twin Cities Tundra', 'Edina', 'MN'],
  ['Peach State Prospects', 'Marietta', 'GA'],
  ['Empire Diamond Kings', 'Rochester', 'NY'],
  ['Show-Me Sluggers', "Lee's Summit", 'MO'],
];

const FIRST = ['Mason', 'Leo', 'Jackson', 'Carter', 'Luca', 'Eli', 'Owen', 'Wyatt', 'Henry', 'Cole', 'Brody', 'Nolan', 'Gavin', 'Ty', 'Max', 'Cam', 'Jace', 'Rowan', 'Beau', 'Asher', 'Miles', 'Kai', 'Reid', 'Tate'];
const LAST = ['Reed', 'Diaz', 'Hart', 'Nguyen', 'Brooks', 'Sullivan', 'Patel', 'Romero', 'Walsh', 'Kim', 'Foster', 'Hayes', 'Price', 'Ortiz', 'Barnes', 'Fischer', 'Coleman', 'Lopez', 'Rivera', 'Bennett', 'Moreno', 'Murphy', 'Jensen', 'Carter'];
const PARENT = ['Jamie', 'Chris', 'Alex', 'Morgan', 'Taylor', 'Jordan', 'Casey', 'Riley', 'Drew', 'Sam'];

export const DEMO_USERS = {
  fan: { id: 'demo-parent', email: 'parent@demo.app', name: 'Libby Reed', role: 'fan' as const },
  director: { id: 'demo-director', email: 'director@demo.app', name: 'Pat Director', role: 'director' as const },
};

function isoDate(d: Date): string {
  return localDateKey(d.toISOString(), DEFAULT_TZ);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type SeedTables = { [K in keyof Tables]: Tables[K][] };

export function buildSeed(now = new Date()): SeedTables {
  const rand = rng(42);
  const today = isoDate(now);
  const arrival = addDays(today, -1);
  const eventId = 'evt-demo';
  const event = {
    id: eventId,
    name: 'Sample week',
    startsOn: arrival,
    endsOn: addDays(arrival, 5),
    venue: 'Cooperstown Baseball Complex',
    address: 'Cooperstown, NY 13326',
    latitude: 42.6584,
    longitude: -74.9605,
    checkInWindow: '12:00 PM – 6:00 PM ET on arrival day',
    timezone: DEFAULT_TZ,
    published: true,
    settings: null,
  };

  const teams: Team[] = TEAMS.map(([name, city, state], i) => ({
    id: `team-${i + 1}`,
    eventId,
    name,
    city,
    state,
    code: `${name.split(' ').pop()!.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4).padEnd(4, 'X')}-${['7K2Q', 'M4TX', 'H8RN', 'B3WZ', 'Q9PL', 'C6VD', 'D2JS', 'R5NK', 'H7MA', 'B4TS', 'O3RC', 'G8TR', 'T6ND', 'P2SP', 'K9NG', 'S5LG'][i]}`,
    pool: null,
    organization: name,
    rosterSize: 12,
    coachName: `Coach ${LAST[(i * 5) % LAST.length]}`,
    coachEmail: `coach${i + 1}@demo.app`,
    coachPhone: `555-01${String(i).padStart(2, '0')}`,
    externalId: `LA-${1000 + i}`,
  }));

  const players: Player[] = [];
  teams.forEach((team, ti) => {
    for (let p = 0; p < 12; p++) {
      const first = FIRST[(ti * 7 + p * 3) % FIRST.length];
      const last = ti === 0 && p === 0 ? 'Reed' : LAST[(ti * 3 + p * 5) % LAST.length];
      const isDemoChild = ti === 0 && p === 0;
      const checkedIn = rand() > 0.12;
      players.push({
        id: `player-${ti + 1}-${p + 1}`,
        teamId: team.id,
        firstName: isDemoChild ? 'Mason' : first,
        lastName: last,
        jerseyNumber: String([1, 2, 3, 5, 7, 8, 10, 11, 12, 14, 22, 27][p]),
        birthDate: `2014-${String((p % 12) + 1).padStart(2, '0')}-${String(((ti + p) % 27) + 1).padStart(2, '0')}`,
        guardianName: isDemoChild ? DEMO_USERS.fan.name : `${PARENT[(ti + p) % PARENT.length]} ${last}`,
        guardianEmail: isDemoChild ? DEMO_USERS.fan.email : `parent.${ti + 1}.${p + 1}@demo.app`,
        guardianPhone: `555-1${String(ti).padStart(2, '0')}${String(p).padStart(1, '0')}`,
        checkInToken: `DEMO${String(ti + 1).padStart(2, '0')}${String(p + 1).padStart(2, '0')}TKN`,
        checkedInAt: isDemoChild ? null : checkedIn ? zonedToIso(arrival, `${12 + Math.floor(rand() * 6)}:${String(Math.floor(rand() * 60)).padStart(2, '0')}`) : null,
        checkedInBy: checkedIn && !isDemoChild ? DEMO_USERS.director.id : null,
        externalId: null,
      });
    }
  });

  // The sample week runs on the same engine as a real week: 6 pool games each, then three brackets.
  const days = Array.from({ length: 6 }, (_, i) => ({ date: addDays(arrival, i), start: '08:00', end: '22:00', pool: i <= 3, bracket: i >= 3 }));
  const plan = planWeek(
    teams.map((t) => ({ id: t.id, name: t.name, club: t.organization ?? '', state: t.state })),
    { fields: fieldNames(12), days, slotMinutes: 120, poolGames: 6, maxPerDay: 2, bracketMaxPerDay: 4, restSlots: 1, brackets: ['Championship', 'Monster', 'Cooper'] },
  );
  const rows = planToGameRows(plan, eventId, DEFAULT_TZ);
  const idOf = (key: string) => `game-${rows.find((r) => r.key === key)!.number}`;
  const nowMs = now.getTime();
  const games: Game[] = rows.map(({ key, winnerToKey, ...row }) => {
    const start = new Date(row.startsAt).getTime();
    const end = new Date(addMinutes(row.startsAt, 120)).getTime();
    // Only pool games get sample scores; bracket games wait for seeds.
    const done = row.stage === 'pool' && end < nowMs;
    const live = row.stage === 'pool' && !done && start <= nowMs;
    const hs = Math.floor(rand() * 11);
    let as = Math.floor(rand() * 11);
    if (as === hs) as = (as + 1 + Math.floor(rand() * 3)) % 12;
    return {
      ...row,
      id: idOf(key),
      winnerToGameId: winnerToKey ? idOf(winnerToKey) : null,
      homeScore: done || live ? (live ? Math.min(hs, 3) : hs) : null,
      awayScore: done || live ? (live ? Math.min(as, 2) : as) : null,
      status: done ? 'final' : live ? 'live' : 'scheduled',
      baseballsUsed: done ? 8 + Math.floor(rand() * 9) : null,
    };
  });

  // The real 2027 season: rolling 6-day weeks from May 30. Week 1 holds the actual registered teams, ready to schedule.
  const season = generateSeasonWeeks(WEEK1_2027_START, 16).map((w, i) => ({
    ...event,
    ...w,
    id: `evt-2027-w${i + 1}`,
    published: i === 0,
  }));
  const week1Teams: Team[] = WEEK1_2027_TEAMS.map((t, i) => ({
    id: `w1-team-${i + 1}`,
    eventId: season[0].id,
    name: t.name,
    city: t.city,
    state: t.state,
    code: `${teamPrefix(t.name)}-${(1296 + i * 37).toString(36).toUpperCase()}`,
    pool: null,
    organization: t.organization,
    rosterSize: t.players,
    coachName: null,
    coachEmail: null,
    coachPhone: null,
    externalId: null,
  }));

  const at = (dayOffset: number, time: string) => zonedToIso(addDays(arrival, dayOffset), time);

  return {
    events: [event, ...season],
    teams: [...teams, ...week1Teams],
    players,
    games,
    follows: [{ id: 'follow-1', userId: DEMO_USERS.fan.id, teamId: 'team-1' }],
    invites: teams.flatMap((t) =>
      players
        .filter((p) => p.teamId === t.id)
        .map((p) => ({ id: `inv-${p.id}`, teamId: t.id, email: p.guardianEmail!, name: p.guardianName, sentAt: at(-14, '10:00') })),
    ),
    notifications: [
      {
        id: 'n-1',
        eventId,
        kind: 'general',
        title: 'Welcome to Cooperstown!',
        body: 'Check-in opens at noon on arrival day. Have your player QR code ready on your phone.',
        teamIds: [],
        createdAt: at(-1, '09:00'),
        createdBy: DEMO_USERS.director.id,
      },
      {
        id: 'n-2',
        eventId,
        kind: 'weather',
        title: 'Heat advisory this afternoon',
        body: 'Highs near 90°F. Water stations are at every field. Sunscreen and hats strongly recommended.',
        teamIds: [],
        createdAt: at(1, '07:15'),
        createdBy: DEMO_USERS.director.id,
      },
      {
        id: 'n-3',
        eventId,
        kind: 'schedule',
        title: 'Opening Ceremonies at 7:30 AM ET',
        body: 'Teams line up behind their banner at the main stadium by 7:00 AM ET in full uniform.',
        teamIds: [],
        createdAt: at(0, '18:30'),
        createdBy: DEMO_USERS.director.id,
      },
    ],
    meeting_slots: [
      ['Parent orientation', 'What to expect this week, safety, and Q&A with the tournament director.', 'Main Pavilion', at(0, '15:00'), 45, 120],
      ['Team photo session', 'Full uniform, caps on. Arrive 10 minutes early.', 'Photo Tent', at(1, '11:00'), 20, 1],
      ['Team photo session', 'Full uniform, caps on. Arrive 10 minutes early.', 'Photo Tent', at(1, '11:30'), 20, 1],
      ['Team photo session', 'Full uniform, caps on. Arrive 10 minutes early.', 'Photo Tent', at(2, '11:00'), 20, 1],
      ['Coaches meeting', 'Rules, bracket format and umpire Q&A. Head coach required.', 'Director Office', at(0, '19:00'), 60, 30],
      ['Director office hours', 'Questions about lodging, medical, or schedule. 10-minute slots.', 'Director Office', at(2, '13:00'), 10, 1],
      ['Director office hours', 'Questions about lodging, medical, or schedule. 10-minute slots.', 'Director Office', at(2, '13:15'), 10, 1],
      ['Hall of Fame group visit', 'Guided museum walk for families. Wristband required.', 'Main Street Shuttle Stop', at(3, '09:00'), 120, 40],
    ].map(([title, description, location, startsAt, durationMinutes, capacity], i) => ({
      id: `slot-${i + 1}`,
      eventId,
      title: title as string,
      description: description as string,
      location: location as string,
      startsAt: startsAt as string,
      durationMinutes: durationMinutes as number,
      capacity: capacity as number,
      bookedCount: 0,
    })),
    meeting_bookings: [],
    team_checkins: [],
    umpire_codes: [
      { id: 'ump-1', eventId: 'evt-2027-w1', code: 'UMP2027', label: 'Mike R. (Fields 1–6)', active: true, lastUsedAt: null },
      { id: 'ump-2', eventId: 'evt-2027-w1', code: 'UMPCREW', label: 'Field 7–12 crew', active: true, lastUsedAt: null },
      { id: 'ump-3', eventId, code: 'UMPDEMO', label: 'Demo umpire', active: true, lastUsedAt: null },
    ],
    photo_products: [
      ['Team Photo 8×10', 'Official team portrait, printed and mailed home.', 2500, 'print'],
      ['Player Memory Mate', 'Individual portrait with team photo inset, 8×10.', 3000, 'print'],
      ['Player Trading Cards (24)', 'Custom cards with photo, position and stats line.', 3500, 'print'],
      ['Action Photo Bundle', 'Every in-game action shot of your player, printed 5×7.', 6000, 'print'],
      ['Champion Package', 'Team photo, memory mate, 24 trading cards, and action bundle.', 11000, 'bundle'],
    ].map(([name, description, priceCents, kind], i) => ({
      id: `prod-${i + 1}`,
      eventId,
      name: name as string,
      description: description as string,
      priceCents: priceCents as number,
      kind: kind as 'print' | 'bundle',
      active: true,
    })),
    photo_orders: [],
  };
}
