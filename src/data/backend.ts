import type {
  AppNotification,
  EventWeek,
  Game,
  Invite,
  MeetingBooking,
  MeetingSlot,
  PhotoOrder,
  PhotoProduct,
  Player,
  Profile,
  Role,
  Team,
  TeamCheckin,
  UmpireCode,
} from './types';

/** Table name -> row type. Keys are the Postgres table names. */
export interface Tables {
  events: EventWeek;
  teams: Team;
  players: Player;
  games: Game;
  notifications: AppNotification;
  meeting_slots: MeetingSlot;
  meeting_bookings: MeetingBooking;
  photo_products: PhotoProduct;
  photo_orders: PhotoOrder;
  invites: Invite;
  umpire_codes: UmpireCode;
  team_checkins: TeamCheckin;
  follows: { id: string; userId: string; teamId: string };
}

export type TableName = keyof Tables;

export interface Query<T> {
  eq?: Partial<T>;
  in?: { column: keyof T & string; values: unknown[] };
  order?: { column: keyof T & string; ascending?: boolean };
}

export interface CheckInResult {
  player: Player;
  team: Team | null;
  alreadyCheckedIn: boolean;
}

export interface UmpireWeek {
  event: Pick<EventWeek, 'id' | 'name' | 'startsOn' | 'endsOn' | 'timezone'>;
  /** The code's label, e.g. the umpire's name. */
  label: string;
  games: Game[];
  teams: Pick<Team, 'id' | 'name'>[];
}

export interface InviteEmail {
  to: string;
  name: string | null;
  teamName: string;
  /** e.g. "Week 4 · Oct 24 – Oct 30" */
  week: string;
  code: string;
  link: string;
}

/** What the connected database supports; screens hide what it doesn't. */
export interface Features {
  /** Parents sign in (otherwise they browse published weeks as guests). */
  familyAccounts: boolean;
  /** Families follow teams with invite codes (otherwise they pick from the list). */
  followCodes: boolean;
  /** Player rosters, parent links and per-player QR check-in. */
  rosters: boolean;
  /** Push alerts and the alerts feed. */
  alerts: boolean;
  meetings: boolean;
  photos: boolean;
  /** Invite emails with team codes. */
  invites: boolean;
  /** "Live", "delayed" and "postponed" game states (otherwise scheduled / final / cancelled). */
  liveStatus: boolean;
}

export interface Backend {
  /** demo: sample data on this device. cooperstown: the Cooperstown All Star Village database. */
  readonly mode: 'demo' | 'cooperstown';
  readonly features: Features;

  // --- auth -----------------------------------------------------------------
  currentProfile(): Profile | null;
  onAuthChange(cb: (p: Profile | null) => void): () => void;
  /** Ready once any persisted session has been restored. */
  ready(): Promise<void>;
  sendSignInCode?(email: string): Promise<void>;
  verifySignInCode?(email: string, code: string): Promise<void>;
  /** Staff sign in with email and password. */
  signInWithPassword?(email: string, password: string): Promise<void>;
  /** Families browse published weeks without an account. */
  continueAsGuest?(): Promise<void>;
  /** Demo backend only: sign in as a sample user. */
  demoSignIn?(role: Role): Promise<void>;
  signOut(): Promise<void>;
  updateProfile(patch: Partial<Pick<Profile, 'name'>>): Promise<void>;

  // --- generic data ---------------------------------------------------------
  select<K extends TableName>(table: K, query?: Query<Tables[K]>): Promise<Tables[K][]>;
  insert<K extends TableName>(table: K, rows: Partial<Tables[K]>[]): Promise<Tables[K][]>;
  update<K extends TableName>(table: K, id: string, patch: Partial<Tables[K]>): Promise<void>;
  remove<K extends TableName>(table: K, ids: string[]): Promise<void>;
  /** Called with the table name whenever rows change (locally or remotely). */
  subscribe(table: TableName, cb: () => void): () => void;

  // --- operations that need server-side privileges ---------------------------
  /** Follows the team for the signed-in user; returns the team. */
  followTeam(code: string): Promise<Team>;
  /** Players whose guardian email matches the signed-in user (includes check-in tokens). */
  myPlayers(): Promise<Player[]>;
  checkInByToken(token: string): Promise<CheckInResult>;
  /** Sends team-code invitation emails; returns the number of emails sent. */
  sendInvites(inviteIds: string[]): Promise<number>;
  /** Starts payment for an order; returns a hosted checkout URL, or null if paid immediately (demo). */
  startCheckout(orderId: string): Promise<string | null>;
  registerPushToken(token: string, platform: string): Promise<void>;

  /** The week's field names in order, when the database keeps them per week. */
  weekFields?(eventId: string): Promise<string[]>;

  // --- umpires (no account: the week's umpire code unlocks scoring) ---------
  /** The week's games for an umpire code; throws with a readable message for a bad code. */
  umpireGames(code: string): Promise<UmpireWeek>;
  /** Saves a final score and baseballs used. Notifies both teams and advances a bracket winner. */
  umpireScore(code: string, gameId: string, homeScore: number, awayScore: number, baseballs: number | null): Promise<void>;
  /** Demo only: emails that "would have been sent". */
  outbox?(): InviteEmail[];
}
