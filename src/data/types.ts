export type Role = 'fan' | 'coach' | 'director';

export interface EventWeek {
  id: string;
  name: string;
  /** ISO date (YYYY-MM-DD) of arrival day. */
  startsOn: string;
  /** ISO date (YYYY-MM-DD) of departure day. */
  endsOn: string;
  venue: string;
  address: string;
  latitude: number;
  longitude: number;
  /** Arrival / check-in window shown to families, e.g. "Fri 12:00 PM – 6:00 PM". */
  checkInWindow: string;
  timezone: string;
}

export interface Team {
  id: string;
  eventId: string;
  name: string;
  city: string;
  state: string;
  /**
   * Short code families use to follow a team, e.g. "RAYS-7K2Q". Only visible
   * to directors (null for everyone else).
   */
  code: string | null;
  pool: string | null;
  coachName: string | null;
  coachEmail: string | null;
  coachPhone: string | null;
  /** External id from the registration provider (LeagueApps team id). */
  externalId: string | null;
}

export interface Player {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  jerseyNumber: string | null;
  birthDate: string | null;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  /** Opaque token encoded into the player's check-in QR code. */
  checkInToken: string;
  checkedInAt: string | null;
  checkedInBy: string | null;
  externalId: string | null;
}

export type GameStatus = 'scheduled' | 'live' | 'final' | 'delayed' | 'postponed' | 'cancelled';
export type GameStage = 'pool' | 'bracket';

export interface Game {
  id: string;
  eventId: string;
  field: string;
  /** ISO timestamp. */
  startsAt: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  /** Shown when a team is not yet known, e.g. "Winner G41". */
  homeLabel: string | null;
  awayLabel: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: GameStatus;
  stage: GameStage;
  /** Bracket play only: which bracket, e.g. "Championship", "Monster", "Cooper". */
  bracket: string | null;
  round: string | null;
  /** Short display number, e.g. 41 for "G41". */
  number: number;
  /** Bracket games: the game the winner advances to, and which side. */
  winnerToGameId: string | null;
  winnerToSlot: 'home' | 'away' | null;
  note: string | null;
}

export type NotificationKind = 'general' | 'weather' | 'schedule' | 'score' | 'checkin';

export interface AppNotification {
  id: string;
  eventId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Teams that receive this. Empty means everyone at the event. */
  teamIds: string[];
  createdAt: string;
  createdBy: string | null;
}

export interface MeetingSlot {
  id: string;
  eventId: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  /** Maintained by the server so families see availability without seeing others' bookings. */
  bookedCount: number;
}

export interface MeetingBooking {
  id: string;
  slotId: string;
  userId: string;
  playerId: string | null;
  name: string;
  note: string | null;
  createdAt: string;
}

export interface PhotoProduct {
  id: string;
  eventId: string;
  name: string;
  description: string;
  priceCents: number;
  kind: 'print' | 'digital' | 'bundle';
  active: boolean;
}

export interface PhotoOrderItem {
  productId: string;
  quantity: number;
  unitPriceCents: number;
}

export interface PhotoOrder {
  id: string;
  userId: string;
  playerId: string | null;
  items: PhotoOrderItem[];
  totalCents: number;
  status: 'pending' | 'paid' | 'fulfilled' | 'cancelled';
  createdAt: string;
}

export interface Invite {
  id: string;
  teamId: string;
  email: string;
  name: string | null;
  sentAt: string | null;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
}
