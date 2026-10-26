import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { normalizeTeamCode } from '../lib/codes';
import type { Backend, Query, TableName, Tables } from './backend';
import type { Player, Profile, Team } from './types';

// --- snake_case <-> camelCase ---------------------------------------------------

const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function camelize<T>(row: any): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row ?? {})) out[toCamel(k)] = v;
  return out as T;
}

function snakeize(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (v !== undefined) out[toSnake(k)] = v;
  return out;
}

/** Readable event columns (the umpire code is director-only, merged in from an RPC). */
const EVENT_COLUMNS = 'id, name, starts_on, ends_on, venue, address, latitude, longitude, check_in_window, timezone, created_at';

/** Fields the client never writes directly (owned by the database). */
const READ_ONLY: Partial<Record<TableName, string[]>> = { teams: ['code'], meeting_slots: ['bookedCount'] };

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const client: SupabaseClient = createClient(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  });

  let profile: Profile | null = null;
  const authListeners = new Set<(p: Profile | null) => void>();

  async function loadProfile(userId: string | undefined) {
    if (!userId) {
      profile = null;
    } else {
      const { data } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
      profile = data ? camelize<Profile>(data) : null;
    }
    authListeners.forEach((cb) => cb(profile));
  }

  const readyPromise = client.auth.getSession().then(({ data }) => loadProfile(data.session?.user.id));
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
      // defer: supabase-js warns against awaiting other calls inside this callback
      setTimeout(() => loadProfile(session?.user.id), 0);
    }
  });

  const isDirector = () => profile?.role === 'director';

  function fail(error: { message: string } | null) {
    if (error) throw new Error(error.message);
  }

  /** Non-directors read players through a view that hides contact details and tokens. */
  const readSource = (table: TableName) => (table === 'players' && !isDirector() ? 'player_roster' : table);

  const backend: Backend = {
    mode: 'supabase',

    currentProfile: () => profile,
    onAuthChange(cb) {
      authListeners.add(cb);
      return () => authListeners.delete(cb);
    },
    ready: () => readyPromise,
    async sendSignInCode(email) {
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      fail(error);
    },
    async verifySignInCode(email, code) {
      const { data, error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
      fail(error);
      await loadProfile(data.user?.id);
    },
    async signOut() {
      await client.auth.signOut();
    },
    async updateProfile(patch) {
      if (!profile) return;
      const { error } = await client.from('profiles').update(snakeize(patch)).eq('id', profile.id);
      fail(error);
      await loadProfile(profile.id);
    },

    async select(table, query) {
      const source = readSource(table);
      const columns = table === 'teams' && isDirector() ? '*, team_codes(code)' : table === 'events' ? EVENT_COLUMNS : '*';
      let q = client.from(source).select(columns);
      for (const [k, v] of Object.entries(query?.eq ?? {})) q = q.eq(toSnake(k), v as never);
      if (query?.in) q = q.in(toSnake(query.in.column), query.in.values as never[]);
      if (query?.order) q = q.order(toSnake(query.order.column), { ascending: query.order.ascending ?? true });
      const { data, error } = await q.limit(5000);
      fail(error);
      if (table === 'events') {
        const codes = isDirector() ? ((await client.rpc('event_umpire_codes')).data ?? []) : [];
        const byId = new Map((codes as { id: string; umpire_code: string | null }[]).map((c) => [c.id, c.umpire_code]));
        return ((data ?? []) as unknown as { id: string }[]).map((row) => camelize({ ...row, umpire_code: byId.get(row.id) ?? null })) as Tables[typeof table][];
      }
       
      return (data ?? []).map((row: any) => {
        if (table === 'teams') {
          const codes = row.team_codes;
          delete row.team_codes;
          row.code = (Array.isArray(codes) ? codes[0]?.code : codes?.code) ?? null;
        }
        return camelize(row);
      }) as Tables[typeof table][];
    },

    async insert(table, rows) {
      const strip = READ_ONLY[table] ?? [];
      const payload = rows.map((r) => {
        const copy = { ...(r as Record<string, unknown>) };
        strip.forEach((k) => delete copy[k]);
        return snakeize(copy);
      });
      const { data, error } = await client.from(table).insert(payload).select(table === 'events' ? EVENT_COLUMNS : '*');
      fail(error);
      const created = (data ?? []).map((r) => camelize<Record<string, unknown>>(r));
      if (table === 'teams') {
        // Follow codes live in a director-only table so rosters can't be discovered.
        const codes = created
          .map((t, i) => ({ team_id: t.id, code: (rows[i] as Partial<Team>).code }))
          .filter((c) => c.code);
        if (codes.length) fail((await client.from('team_codes').insert(codes)).error);
        created.forEach((t, i) => (t.code = (rows[i] as Partial<Team>).code ?? null));
      }
      return created as unknown as Tables[typeof table][];
    },

    async update(table, id, patch) {
      const copy = { ...(patch as Record<string, unknown>) };
      (READ_ONLY[table] ?? []).forEach((k) => delete copy[k]);
      delete copy.id;
      const { error } = await client.from(table).update(snakeize(copy)).eq('id', id);
      fail(error);
    },

    async remove(table, ids) {
      if (ids.length === 0) return;
      const { error } = await client.from(table).delete().in('id', ids);
      fail(error);
    },

    subscribe(table, cb) {
      const channel = client
        .channel(`rt-${table}-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => cb())
        .subscribe();
      return () => {
        client.removeChannel(channel);
      };
    },

    async followTeam(code) {
      const { data, error } = await client.rpc('follow_team', { p_code: normalizeTeamCode(code) });
      fail(error);
      return { ...camelize<Team>(data), code: null };
    },

    async myPlayers() {
      const { data, error } = await client.rpc('my_players');
      fail(error);
      return (data ?? []).map((r: unknown) => camelize<Player>(r));
    },

    async checkInByToken(token) {
      const { data, error } = await client.rpc('check_in_player', { p_token: token });
      fail(error);
      return {
        player: camelize<Player>(data.player),
        team: data.team ? camelize<Team>(data.team) : null,
        alreadyCheckedIn: !!data.already_checked_in,
      };
    },

    async sendInvites(inviteIds) {
      const { data, error } = await client.functions.invoke('send-invites', { body: { inviteIds } });
      fail(error);
      return data?.sent ?? 0;
    },

    async startCheckout(orderId) {
      const { data, error } = await client.functions.invoke('create-checkout', { body: { orderId } });
      fail(error);
      return data?.url ?? null;
    },

    async umpireGames(code) {
      const { data, error } = await client.rpc('ump_games', { p_code: code.trim().toUpperCase() });
      fail(error);
      if (data?.error) throw new Error(data.error);
      return {
        event: camelize(data.event),
        games: (data.games ?? []).map((g: unknown) => camelize(g)),
        teams: data.teams ?? [],
      };
    },

    async umpireScore(code, gameId, homeScore, awayScore, baseballs) {
      const { data, error } = await client.rpc('ump_score', {
        p_code: code.trim().toUpperCase(),
        p_game: gameId,
        p_home: homeScore,
        p_away: awayScore,
        p_balls: baseballs,
      });
      fail(error);
      if (data?.error) throw new Error(data.error);
    },

    async registerPushToken(token, platform) {
      if (!profile) return;
      const { error } = await client
        .from('push_tokens')
        .upsert({ token, user_id: profile.id, platform, updated_at: new Date().toISOString() }, { onConflict: 'token' });
      fail(error);
    },
  };
  return backend;
}

export type { Query };
