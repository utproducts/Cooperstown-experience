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

export interface InviteEmail {
  to: string;
  name: string | null;
  teamName: string;
  /** e.g. "Week 4 · Oct 24 – Oct 30" */
  week: string;
  code: string;
  link: string;
}

export interface Backend {
  readonly mode: 'demo' | 'supabase';

  // --- auth -----------------------------------------------------------------
  currentProfile(): Profile | null;
  onAuthChange(cb: (p: Profile | null) => void): () => void;
  /** Ready once any persisted session has been restored. */
  ready(): Promise<void>;
  sendSignInCode(email: string): Promise<void>;
  verifySignInCode(email: string, code: string): Promise<void>;
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
  /** Demo only: emails that "would have been sent". */
  outbox?(): InviteEmail[];
}
