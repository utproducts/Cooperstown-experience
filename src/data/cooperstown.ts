// The app on the Cooperstown All Star Village database (utproducts/cooperstown, Supabase project "cooperstown").
// Uses only the publishable key: the database's row-level security decides everything. Families read published weeks
// without an account (followed teams are kept on the device); staff sign in with their email and password; umpires
// score through ump_games / ump_score with their own code. Tables for family accounts, rosters, alerts, meetings and
// photos don't exist there yet (see supabase/phase2-proposal), so those features are switched off.
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { randomToken } from '../lib/codes';
import type { Backend, Features, Query, TableName, Tables } from './backend';
import {
  toCheckin,
  toEvent,
  toGame,
  toGameInsert,
  toGamePatch,
  toTeam,
  toUmpireCode,
  umpGameToGame,
  winnerIndex,
  type CheckinRow,
  type ContactRow,
  type FieldRow,
  type GameRow,
  type TeamRow,
  type UmpireCodeRow,
  type WeekRow,
} from './cooperstown-map';
import type { Game, Profile, Team } from './types';

const FEATURES: Features = {
  familyAccounts: false,
  followCodes: false,
  rosters: false,
  alerts: false,
  meetings: false,
  photos: false,
  invites: false,
  liveStatus: false,
};

const GUEST_KEY = 'cxp-coop-guest';
const FOLLOWS_KEY = 'cxp-coop-follows';
const GUEST: Profile = { id: 'guest', email: '', name: 'Guest', role: 'fan' };

// Chad's site's defaults for a new week (utproducts/cooperstown lib/week.ts DEFAULT_SETTINGS).
const DEFAULT_SETTINGS = {
  days: Array.from({ length: 6 }, (_, i) => ({ start: '08:00', end: '22:00', pool: i <= 3, bracket: i >= 3 })),
  slotMinutes: 120,
  poolGames: 6,
  maxPerDay: 3,
  bracketMaxPerDay: 4,
  restSlots: 1,
  brackets: ['Championship', 'Monster', 'Cooper'],
  checkinItems: ['Roster verified', 'Waivers signed', 'Wristbands handed out', 'Lodging keys'],
};

const notAvailable = (what: string) => new Error(`${what} isn't available yet on the Cooperstown database.`);

export function createCooperstownBackend(url: string, publishableKey: string): Backend {
  const client = createClient(url, publishableKey, {
    auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: Platform.OS === 'web' },
  });

  let profile: Profile | null = null;
  let follows: { id: string; userId: string; teamId: string }[] = [];
  const authListeners = new Set<(p: Profile | null) => void>();
  const localListeners = new Map<TableName, Set<() => void>>();
  // Lookups the mapping needs, refreshed with each read.
  const fieldsByWeek = new Map<string, FieldRow[]>();
  const ageGroupByWeek = new Map<string, string>();

  const fail = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };
  const isStaff = () => profile?.role === 'director';
  const emitLocal = (t: TableName) => localListeners.get(t)?.forEach((cb) => cb());

  async function loadProfile(userId: string | undefined, email?: string) {
    if (userId) {
      const { data } = await client.from('staff').select('user_id, email, name, role').eq('user_id', userId).maybeSingle();
      profile = data
        ? { id: data.user_id, email: data.email, name: data.name || data.email, role: 'director' }
        : { id: userId, email: email ?? '', name: (email ?? '').split('@')[0], role: 'fan' };
    } else {
      profile = (await AsyncStorage.getItem(GUEST_KEY).catch(() => null)) ? GUEST : null;
    }
    authListeners.forEach((cb) => cb(profile));
  }

  const readyPromise = (async () => {
    try {
      follows = JSON.parse((await AsyncStorage.getItem(FOLLOWS_KEY)) ?? '[]');
    } catch {
      follows = [];
    }
    const { data } = await client.auth.getSession();
    await loadProfile(data.session?.user.id, data.session?.user.email);
  })();
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setTimeout(() => loadProfile(session?.user.id, session?.user.email), 0);
  });

  async function fieldsFor(weekId: string): Promise<FieldRow[]> {
    const { data, error } = await client.from('fields').select('id, week_id, name, sort').eq('week_id', weekId).order('sort').order('id');
    fail(error);
    fieldsByWeek.set(weekId, (data ?? []) as FieldRow[]);
    return fieldsByWeek.get(weekId)!;
  }
  const fieldIdMap = (weekId: string) => new Map((fieldsByWeek.get(weekId) ?? []).map((f) => [f.name, f.id]));

  async function weekOfGame(id: string): Promise<string> {
    const { data, error } = await client.from('games').select('week_id').eq('id', Number(id)).single();
    fail(error);
    return data!.week_id as string;
  }

  /** Keeps only filters on keys the caller passed; applied after mapping for anything the database can't filter. */
  function matches<T>(row: T, q?: Query<T>): boolean {
    if (!q) return true;
    for (const [k, v] of Object.entries(q.eq ?? {})) if ((row as Record<string, unknown>)[k] !== v) return false;
    if (q.in && !q.in.values.includes((row as Record<string, unknown>)[q.in.column])) return false;
    return true;
  }
  function ordered<T>(rows: T[], q?: Query<T>): T[] {
    if (!q?.order) return rows;
    const { column, ascending = true } = q.order;
    return [...rows].sort((a, b) => {
      const av = (a as Record<string, unknown>)[column] as string | number;
      const bv = (b as Record<string, unknown>)[column] as string | number;
      return (av < bv ? -1 : av > bv ? 1 : 0) * (ascending ? 1 : -1);
    });
  }

  async function selectGames(weekIds: string[] | null): Promise<Game[]> {
    let q = client.from('games').select('*');
    if (weekIds) q = q.in('week_id', weekIds);
    const { data, error } = await q.order('game_date').order('start_time').order('id').limit(5000);
    fail(error);
    const rows = (data ?? []) as GameRow[];
    const weeks = [...new Set(rows.map((r) => r.week_id))];
    await Promise.all(weeks.map((w) => (fieldsByWeek.has(w) ? null : fieldsFor(w))));
    const names = new Map(weeks.flatMap((w) => (fieldsByWeek.get(w) ?? []).map((f) => [f.id, f.name] as [number, string])));
    const winners = winnerIndex(rows);
    return rows.map((r) => toGame(r, names, winners));
  }

  const backend: Backend = {
    mode: 'cooperstown',
    features: FEATURES,

    currentProfile: () => profile,
    onAuthChange(cb) {
      authListeners.add(cb);
      return () => authListeners.delete(cb);
    },
    ready: () => readyPromise,
    async signInWithPassword(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      fail(error);
      await AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
      await loadProfile(data.user?.id, data.user?.email);
    },
    async continueAsGuest() {
      await AsyncStorage.setItem(GUEST_KEY, '1').catch(() => {});
      profile = GUEST;
      authListeners.forEach((cb) => cb(profile));
    },
    async signOut() {
      await AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
      if (profile && profile.id !== GUEST.id) await client.auth.signOut();
      profile = null;
      authListeners.forEach((cb) => cb(null));
    },
    async updateProfile() {},

    async select(table, query) {
      const q = query as Query<Record<string, unknown>> | undefined;
      const eventId = (q?.eq?.eventId as string | undefined) ?? undefined;
      let rows: unknown[];
      switch (table) {
        case 'events': {
          const { data, error } = await client.from('weeks').select('id, name, start_date, end_date, published, settings').order('start_date');
          fail(error);
          rows = ((data ?? []) as WeekRow[]).map(toEvent);
          break;
        }
        case 'teams': {
          let tq = client.from('teams').select('id, week_id, age_group, name, organization, city, state, players, coaches, sort');
          if (eventId) tq = tq.eq('week_id', eventId);
          const { data, error } = await tq.order('sort').order('name').limit(5000);
          fail(error);
          const teams = (data ?? []) as TeamRow[];
          for (const t of teams) if (!ageGroupByWeek.has(t.week_id)) ageGroupByWeek.set(t.week_id, t.age_group);
          let contacts = new Map<string, ContactRow>();
          if (isStaff() && teams.length) {
            const { data: c } = await client.from('team_contacts').select('team_id, rep_name, rep_email, rep_phone').in('team_id', teams.map((t) => t.id));
            contacts = new Map(((c ?? []) as ContactRow[]).map((x) => [x.team_id, x]));
          }
          rows = teams.map((t) => toTeam(t, contacts.get(t.id)));
          break;
        }
        case 'games':
          rows = await selectGames(eventId ? [eventId] : null);
          break;
        case 'umpire_codes': {
          if (!isStaff()) return [];
          let uq = client.from('umpire_codes').select('id, week_id, code, label, active, last_used_at');
          if (eventId) uq = uq.eq('week_id', eventId);
          const { data, error } = await uq.order('created_at');
          fail(error);
          rows = ((data ?? []) as UmpireCodeRow[]).map(toUmpireCode);
          break;
        }
        case 'team_checkins': {
          if (!isStaff()) return [];
          const { data, error } = await client.from('checkins').select('team_id, items, notes, checked_in_at, checked_in_by');
          fail(error);
          rows = ((data ?? []) as CheckinRow[]).map(toCheckin);
          break;
        }
        case 'follows':
          rows = follows;
          break;
        default:
          // Family-side tables (players, alerts, meetings, photos, invites) don't exist here yet.
          return [];
      }
      return ordered(
        (rows as Record<string, unknown>[]).filter((r) => matches(r, q)),
        q,
      ) as unknown as Tables[typeof table][];
    },

    async insert(table, inputRows) {
      const rows = inputRows as Record<string, unknown>[];
      switch (table) {
        case 'events': {
          const payload = rows.map((r) => ({
            name: r.name,
            start_date: r.startsOn,
            end_date: r.endsOn,
            published: Boolean(r.published),
            settings: { ...DEFAULT_SETTINGS, days: DEFAULT_SETTINGS.days.slice(0, dayCount(r.startsOn as string, r.endsOn as string)) },
          }));
          const { data, error } = await client.from('weeks').insert(payload).select('id, name, start_date, end_date, published, settings');
          fail(error);
          return ((data ?? []) as WeekRow[]).map(toEvent) as unknown as Tables[typeof table][];
        }
        case 'teams': {
          const created: Team[] = [];
          for (const r of rows as Partial<Team>[]) {
            const { data, error } = await client
              .from('teams')
              .insert({
                week_id: r.eventId,
                age_group: ageGroupByWeek.get(r.eventId!) ?? '12U',
                name: r.name,
                organization: r.organization ?? '',
                city: r.city ?? '',
                state: r.state ?? '',
                players: r.rosterSize ?? null,
              })
              .select('id, week_id, age_group, name, organization, city, state, players, coaches')
              .single();
            fail(error);
            const contact = { team_id: data!.id, rep_name: r.coachName ?? '', rep_email: r.coachEmail ?? '', rep_phone: r.coachPhone ?? '' };
            if (r.coachName || r.coachEmail || r.coachPhone) fail((await client.from('team_contacts').upsert(contact)).error);
            created.push(toTeam(data as TeamRow, contact));
          }
          return created as unknown as Tables[typeof table][];
        }
        case 'games': {
          const games = rows as Partial<Game>[];
          const weekId = games[0]?.eventId;
          if (!weekId) return [];
          if (!fieldsByWeek.has(weekId)) await fieldsFor(weekId);
          if (!ageGroupByWeek.has(weekId)) {
            const { data } = await client.from('teams').select('age_group').eq('week_id', weekId).limit(1);
            ageGroupByWeek.set(weekId, data?.[0]?.age_group ?? '12U');
          }
          const ctx = { fieldId: fieldIdMap(weekId), ageGroup: ageGroupByWeek.get(weekId)! };
          const out: Game[] = [];
          // In chunks, keeping the input order so callers can match rows (they pass a key in `note`).
          for (let i = 0; i < games.length; i += 200) {
            const chunk = games.slice(i, i + 200);
            const { data, error } = await client.from('games').insert(chunk.map((g) => toGameInsert(g, ctx))).select('*');
            fail(error);
            const names = new Map((fieldsByWeek.get(weekId) ?? []).map((f) => [f.id, f.name] as [number, string]));
            ((data ?? []) as GameRow[]).forEach((row, j) => out.push({ ...toGame(row, names, new Map()), note: chunk[j].note ?? null }));
          }
          return out as unknown as Tables[typeof table][];
        }
        case 'umpire_codes': {
          const payload = rows.map((r) => ({ week_id: r.eventId, code: (r.code as string) || randomToken(6), label: (r.label as string) ?? '' }));
          const { data, error } = await client.from('umpire_codes').insert(payload).select('id, week_id, code, label, active, last_used_at');
          fail(error);
          return ((data ?? []) as UmpireCodeRow[]).map(toUmpireCode) as unknown as Tables[typeof table][];
        }
        case 'follows': {
          const created = rows.map((r) => ({ id: `follow-${randomToken(8)}`, userId: profile?.id ?? GUEST.id, teamId: r.teamId as string }));
          follows = [...follows.filter((f) => !created.some((c) => c.teamId === f.teamId)), ...created];
          await AsyncStorage.setItem(FOLLOWS_KEY, JSON.stringify(follows)).catch(() => {});
          emitLocal('follows');
          return created as unknown as Tables[typeof table][];
        }
        case 'notifications':
        case 'invites':
          // No alerts or invite emails here yet: accept and drop, so schedule changes still go through.
          return rows.map((r) => ({ id: `local-${randomToken(8)}`, ...r })) as unknown as Tables[typeof table][];
        default:
          throw notAvailable(table.replace('_', ' '));
      }
    },

    async update(table, id, patch) {
      const p = patch as Record<string, unknown>;
      switch (table) {
        case 'events': {
          const row: Record<string, unknown> = {};
          if (p.name !== undefined) row.name = p.name;
          if (p.startsOn !== undefined) row.start_date = p.startsOn;
          if (p.endsOn !== undefined) row.end_date = p.endsOn;
          if (p.published !== undefined) row.published = p.published;
          if (p.settings !== undefined) row.settings = p.settings;
          if (Object.keys(row).length) fail((await client.from('weeks').update(row).eq('id', id)).error);
          return;
        }
        case 'teams': {
          const row: Record<string, unknown> = {};
          for (const k of ['name', 'organization', 'city', 'state'] as const) if (p[k] !== undefined) row[k] = p[k] ?? '';
          if (p.rosterSize !== undefined) row.players = p.rosterSize;
          if (Object.keys(row).length) fail((await client.from('teams').update(row).eq('id', id)).error);
          if (p.coachName !== undefined || p.coachEmail !== undefined || p.coachPhone !== undefined) {
            fail(
              (
                await client
                  .from('team_contacts')
                  .upsert({ team_id: id, rep_name: p.coachName ?? '', rep_email: p.coachEmail ?? '', rep_phone: p.coachPhone ?? '' })
              ).error,
            );
          }
          return;
        }
        case 'games': {
          const g = patch as Partial<Game>;
          // A winner link names the later game: that game's side reads "winner:<this id>".
          if (g.winnerToGameId) {
            const col = g.winnerToSlot === 'home' ? 'home_from' : 'away_from';
            fail((await client.from('games').update({ [col]: `winner:${id}` }).eq('id', Number(g.winnerToGameId))).error);
          }
          // Final scores go through the database's scoring function: it checks the game and moves bracket winners on.
          if (g.status === 'final' && g.homeScore != null && g.awayScore != null) {
            const { data, error } = await client.rpc('staff_score', {
              p_game: Number(id),
              p_home: g.homeScore,
              p_away: g.awayScore,
              p_balls: g.baseballsUsed ?? null,
            });
            fail(error);
            if (data?.error) throw new Error(data.error);
            return;
          }
          const weekId = await weekOfGame(id);
          if (g.field !== undefined && !fieldsByWeek.has(weekId)) await fieldsFor(weekId);
          const row = toGamePatch(g, fieldIdMap(weekId));
          if (Object.keys(row).length) fail((await client.from('games').update(row).eq('id', Number(id))).error);
          return;
        }
        case 'umpire_codes': {
          const row: Record<string, unknown> = {};
          if (p.active !== undefined) row.active = p.active;
          if (p.label !== undefined) row.label = p.label;
          fail((await client.from('umpire_codes').update(row).eq('id', Number(id))).error);
          return;
        }
        case 'team_checkins': {
          fail(
            (
              await client.from('checkins').upsert({
                team_id: id,
                items: p.items ?? {},
                notes: p.notes ?? '',
                checked_in_at: p.checkedInAt ?? null,
                checked_in_by: p.checkedInBy ?? '',
                updated_at: new Date().toISOString(),
              })
            ).error,
          );
          return;
        }
        default:
          throw notAvailable(table.replace('_', ' '));
      }
    },

    async remove(table, ids) {
      if (ids.length === 0) return;
      switch (table) {
        case 'games':
          for (let i = 0; i < ids.length; i += 200) fail((await client.from('games').delete().in('id', ids.slice(i, i + 200).map(Number))).error);
          return;
        case 'teams':
          fail((await client.from('teams').delete().in('id', ids)).error);
          return;
        case 'events':
          fail((await client.from('weeks').delete().in('id', ids)).error);
          return;
        case 'umpire_codes':
          fail((await client.from('umpire_codes').delete().in('id', ids.map(Number))).error);
          return;
        case 'follows':
          follows = follows.filter((f) => !ids.includes(f.id));
          await AsyncStorage.setItem(FOLLOWS_KEY, JSON.stringify(follows)).catch(() => {});
          emitLocal('follows');
          return;
        default:
          throw notAvailable(table.replace('_', ' '));
      }
    },

    subscribe(table, cb) {
      if (!localListeners.has(table)) localListeners.set(table, new Set());
      localListeners.get(table)!.add(cb);
      const dbTable = { events: 'weeks', teams: 'teams', games: 'games', umpire_codes: 'umpire_codes', team_checkins: 'checkins' }[table as string];
      if (!dbTable) return () => localListeners.get(table)?.delete(cb);
      // Realtime when the table is published for it; a periodic refresh either way so scores never go stale.
      const channel = client
        .channel(`rt-${dbTable}-${randomToken(6)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: dbTable }, () => cb())
        .subscribe();
      const timer = setInterval(cb, table === 'games' ? 30_000 : 120_000);
      return () => {
        localListeners.get(table)?.delete(cb);
        clearInterval(timer);
        client.removeChannel(channel);
      };
    },

    async followTeam() {
      throw new Error('Pick your team from the list.');
    },
    async myPlayers() {
      return [];
    },
    async checkInByToken() {
      throw notAvailable('Player QR check-in');
    },
    async sendInvites() {
      return 0;
    },
    async startCheckout() {
      throw notAvailable('Photo checkout');
    },
    async registerPushToken() {},

    async weekFields(eventId) {
      return (await fieldsFor(eventId)).map((f) => f.name);
    },

    async umpireGames(code) {
      const { data, error } = await client.rpc('ump_games', { p_code: code.trim().toUpperCase() });
      fail(error);
      if (!data || data.error) throw new Error(data?.error ?? 'Something went wrong. Please try again.');
      const games = (data.games ?? []).map((g: Parameters<typeof umpGameToGame>[0]) => umpGameToGame(g, data.week.id));
      const names = [...new Set(games.flatMap((g: Game) => [g.homeTeamId, g.awayTeamId]).filter(Boolean))] as string[];
      const dates = games.map((g: Game) => g.startsAt).filter((s: string) => !s.startsWith('9999')).sort();
      return {
        event: { id: data.week.id, name: data.week.name, startsOn: dates[0]?.slice(0, 10) ?? '', endsOn: dates.at(-1)?.slice(0, 10) ?? '', timezone: 'America/New_York' },
        label: data.label ?? '',
        games,
        teams: names.map((n) => ({ id: n, name: n })),
      };
    },

    async umpireScore(code, gameId, homeScore, awayScore, baseballs) {
      const { data, error } = await client.rpc('ump_score', {
        p_code: code.trim().toUpperCase(),
        p_game: Number(gameId),
        p_home: homeScore,
        p_away: awayScore,
        p_balls: baseballs,
      });
      fail(error);
      if (data?.error) throw new Error(data.error);
    },
  };
  return backend;
}

function dayCount(start: string, end: string) {
  return Math.max(1, Math.round((new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / 86400000) + 1);
}
