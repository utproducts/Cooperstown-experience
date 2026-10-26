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
  /** Families see a week only once it's published. */
  published: boolean;
  /** Schedule builder settings saved with the week (Cooperstown's week settings), or null for defaults. */
  settings: Record<string, unknown> | null;
}

/** One umpire's (or crew's) scoring code for a week. Directors only. */
export interface UmpireCode {
  id: string;
  eventId: string;
  code: string;
  /** Who it's for, e.g. "Mike R." or "Field 3 crew"; shown as who scored a game. */
  label: string;
  active: boolean;
  lastUsedAt: string | null;
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
  /** Club/organization; pool play never pairs two teams from the same one. */
  organization: string | null;
  /** Roster size from a team-level registration export, before player rows are imported. */
  rosterSize: number | null;
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
  /** Uniform sizes handed out at check-in, by item (the week's uniform items), e.g. { Jersey: 'YL', Hat: 'S/M' }. */
  uniform?: Record<string, string>;
  /** Bunkhouse if not the team's own (a split team). */
  lodgingPlaceId?: string | null;
  lodgingRoom?: string;
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
  /** Shown when a team is not yet known, e.g. "Winner G41" or "Seed #5". */
  homeLabel: string | null;
  awayLabel: string | null;
  /** Bracket games: which overall pool-play seed fills this side once pool play is final. */
  homeSeed: number | null;
  awaySeed: number | null;
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
  /** Baseballs used in the game, entered by the umpire or director. */
  baseballsUsed: number | null;
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

/** A team's arrival check-in (Cooperstown's staff checklist: roster verified, waivers, wristbands, keys…). */
export interface TeamCheckin {
  /** Same as teamId: one check-in per team. */
  id: string;
  teamId: string;
  items: Record<string, boolean>;
  notes: string;
  checkedInAt: string | null;
  checkedInBy: string;
}

// --- venue, shop and park life (005_venue_shop) ---------------------------------------------------------------------

export type PlaceKind =
  | 'field'
  | 'parking'
  | 'checkin'
  | 'bunkhouse'
  | 'trolley'
  | 'food'
  | 'restaurant'
  | 'vendor'
  | 'restroom'
  | 'first_aid'
  | 'info'
  | 'attraction'
  | 'lodging'
  | 'other';

/** A spot at the park (pinned on the site map at x/y, 0..1) or around town (lodging, things to do: no pin). */
export interface Place {
  id: string;
  kind: PlaceKind;
  name: string;
  description: string;
  x: number | null;
  y: number | null;
  hours: string;
  website: string;
  phone: string;
  address: string;
  imageUrl: string;
  /** Restaurants: families can request a table in the app. */
  takesReservations: boolean;
  sort: number;
  active: boolean;
}

/** Site-wide content staff edit: the site map, park photos, park rules. */
export interface VenueSetting {
  /** e.g. 'site_map', 'photos', 'park_rules' */
  id: string;
  value: Record<string, unknown>;
}

export type ProductKind = 'apparel' | 'concession' | 'menu';

export interface Product {
  id: string;
  kind: ProductKind;
  /** null: every week. */
  eventId: string | null;
  /** Menu items: the restaurant. */
  placeId: string | null;
  category: string;
  name: string;
  description: string;
  priceCents: number;
  sizes: string[];
  imageUrl: string;
  active: boolean;
  sort: number;
}

export type ShopOrderStatus = 'new' | 'preparing' | 'ready' | 'out' | 'delivered' | 'picked_up' | 'cancelled';

export interface ShopOrderLine {
  productId: string;
  name: string;
  size: string;
  qty: number;
  priceCents: number;
}

export interface ShopOrder {
  id: string;
  kind: 'apparel' | 'concession';
  eventId: string | null;
  userId: string | null;
  customerName: string;
  customerPhone: string;
  items: ShopOrderLine[];
  totalCents: number;
  deliveryField: string;
  deliverySpot: string;
  notes: string;
  status: ShopOrderStatus;
  payment: 'pay_on_delivery' | 'pay_at_pickup' | 'paid';
  pickupCode: string;
  createdAt: string;
}

export interface Reservation {
  id: string;
  placeId: string;
  userId: string | null;
  onDate: string;
  /** "18:30" (ET) */
  atTime: string;
  partySize: number;
  name: string;
  phone: string;
  notes: string;
  status: 'requested' | 'confirmed' | 'declined' | 'cancelled' | 'seated';
  code: string;
  createdAt: string;
}

export interface SkillsEvent {
  id: string;
  eventId: string;
  name: string;
  description: string;
  /** e.g. 'sec', 'mph', 'ft' */
  unit: string;
  better: 'high' | 'low';
  startsAt: string | null;
  placeId: string | null;
  sort: number;
}

export interface SkillsResult {
  id: string;
  skillsEventId: string;
  teamId: string | null;
  playerId: string | null;
  /** First name and last initial, as shown on the public leaderboard. */
  displayName: string;
  value: number;
  recordedBy: string;
  recordedAt: string;
}

/** A team's bunkhouse for its week (id = teamId). */
export interface TeamLodging {
  id: string;
  teamId: string;
  placeId: string | null;
  room: string;
  notes: string;
}
