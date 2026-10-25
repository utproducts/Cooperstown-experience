import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeTeamCode, randomToken } from '../lib/codes';
import type { Backend, InviteEmail, Query, TableName, Tables } from './backend';
import { buildSeed, DEMO_USERS, type SeedTables } from './seed';
import type { Profile, Role } from './types';

const STORAGE_KEY = 'cxp-demo-v1';

/**
 * In-memory backend with sample data, persisted to device storage. Used when
 * no Supabase project is configured so the whole app can be tried end to end.
 */
export function createDemoBackend(appUrl: string): Backend {
  let db: SeedTables = buildSeed();
  let profile: Profile | null = null;
  let outbox: InviteEmail[] = [];
  const authListeners = new Set<(p: Profile | null) => void>();
  const tableListeners = new Map<TableName, Set<() => void>>();
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const readyPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        // Keep the seeded week "live" relative to today: only reuse state saved today.
        if (saved.savedOn === new Date().toDateString()) {
          db = saved.db;
          outbox = saved.outbox ?? [];
        }
        profile = saved.profile ?? null;
      }
    } catch {
      // storage unavailable (private mode, SSR) — run with fresh seed
    }
  })();

  function persist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ db, profile, outbox, savedOn: new Date().toDateString() })).catch(() => {});
    }, 300);
  }

  function emit(table: TableName) {
    persist();
    tableListeners.get(table)?.forEach((cb) => cb());
  }

  function setProfile(p: Profile | null) {
    profile = p;
    persist();
    authListeners.forEach((cb) => cb(p));
  }

  function requireProfile(): Profile {
    if (!profile) throw new Error('Please sign in first.');
    return profile;
  }

  function requireDirector() {
    if (requireProfile().role !== 'director') throw new Error('Directors only.');
  }

  function matches<T>(row: T, q?: Query<T>): boolean {
    if (!q) return true;
    if (q.eq) {
      for (const [k, v] of Object.entries(q.eq)) if ((row as Record<string, unknown>)[k] !== v) return false;
    }
    if (q.in && !q.in.values.includes((row as Record<string, unknown>)[q.in.column])) return false;
    return true;
  }

  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

  const backend: Backend = {
    mode: 'demo',

    currentProfile: () => profile,
    onAuthChange(cb) {
      authListeners.add(cb);
      return () => authListeners.delete(cb);
    },
    ready: () => readyPromise,
    async sendSignInCode() {
      // demo: any email works, code is 123456
    },
    async verifySignInCode(email, code) {
      if (code !== '123456') throw new Error('In demo mode the code is 123456.');
      const isDirector = email.toLowerCase() === DEMO_USERS.director.email;
      setProfile({
        id: isDirector ? DEMO_USERS.director.id : `user-${email.toLowerCase()}`,
        email: email.toLowerCase(),
        name: email.split('@')[0],
        role: isDirector ? 'director' : 'fan',
      });
    },
    async demoSignIn(role: Role) {
      setProfile({ ...(role === 'director' ? DEMO_USERS.director : DEMO_USERS.fan) });
    },
    async signOut() {
      setProfile(null);
    },
    async updateProfile(patch) {
      setProfile({ ...requireProfile(), ...patch });
    },

    async select(table, query) {
      await readyPromise;
      let rows = (db[table] as Tables[typeof table][]).filter((r) => matches(r, query));
      if (query?.order) {
        const { column, ascending = true } = query.order;
        rows = [...rows].sort((a, b) => {
          const av = (a as Record<string, unknown>)[column] as string | number;
          const bv = (b as Record<string, unknown>)[column] as string | number;
          return (av < bv ? -1 : av > bv ? 1 : 0) * (ascending ? 1 : -1);
        });
      }
      rows = clone(rows);
      if (table === 'teams' && profile?.role !== 'director') {
        rows = rows.map((t) => ({ ...t, code: null }));
      }
      if (table === 'players' && profile?.role !== 'director') {
        rows = rows.map((p) => {
          const player = p as Tables['players'];
          return player.guardianEmail === profile?.email
            ? player
            : { ...player, checkInToken: '', guardianEmail: null, guardianPhone: null, birthDate: null };
        }) as never;
      }
      return rows;
    },

    async insert(table, rows) {
      const created = rows.map((r) => ({ id: `${table}-${randomToken(10)}`, ...r })) as Tables[typeof table][];
      (db[table] as unknown[]).push(...clone(created));
      emit(table);
      return created;
    },

    async update(table, id, patch) {
      const rows = db[table] as { id: string }[];
      const i = rows.findIndex((r) => r.id === id);
      if (i === -1) throw new Error('Not found');
      rows[i] = { ...rows[i], ...clone(patch) };
      emit(table);
    },

    async remove(table, ids) {
      const set = new Set(ids);
      (db[table] as unknown) = (db[table] as { id: string }[]).filter((r) => !set.has(r.id));
      emit(table);
    },

    subscribe(table, cb) {
      if (!tableListeners.has(table)) tableListeners.set(table, new Set());
      tableListeners.get(table)!.add(cb);
      return () => tableListeners.get(table)?.delete(cb);
    },

    async followTeam(code) {
      const me = requireProfile();
      const normalized = normalizeTeamCode(code);
      const team = db.teams.find((t) => t.code === normalized);
      if (!team) throw new Error(`No team found for code ${normalized}.`);
      if (!db.follows.some((f) => f.userId === me.id && f.teamId === team.id)) {
        db.follows.push({ id: `follow-${randomToken(8)}`, userId: me.id, teamId: team.id });
        emit('follows');
      }
      return clone({ ...team, code: me.role === 'director' ? team.code : null });
    },

    async myPlayers() {
      const me = requireProfile();
      return clone(db.players.filter((p) => p.guardianEmail === me.email));
    },

    async checkInByToken(token) {
      requireDirector();
      const player = db.players.find((p) => p.checkInToken === token);
      if (!player) throw new Error('QR code not recognized for this event.');
      const already = !!player.checkedInAt;
      if (!already) {
        player.checkedInAt = new Date().toISOString();
        player.checkedInBy = profile!.id;
        emit('players');
      }
      return clone({ player, team: db.teams.find((t) => t.id === player.teamId) ?? null, alreadyCheckedIn: already });
    },

    async sendInvites(inviteIds) {
      requireDirector();
      let sent = 0;
      for (const inv of db.invites.filter((i) => inviteIds.includes(i.id))) {
        const team = db.teams.find((t) => t.id === inv.teamId);
        if (!team?.code) continue;
        outbox.unshift({ to: inv.email, name: inv.name, teamName: team.name, code: team.code, link: `${appUrl}/follow/${team.code}` });
        inv.sentAt = new Date().toISOString();
        sent++;
      }
      emit('invites');
      return sent;
    },

    async startCheckout(orderId) {
      const order = db.photo_orders.find((o) => o.id === orderId);
      if (!order) throw new Error('Order not found');
      order.status = 'paid';
      emit('photo_orders');
      return null;
    },

    async registerPushToken() {},

    outbox: () => outbox,
  };
  return backend;
}
