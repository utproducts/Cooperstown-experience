import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeTeamCode, randomToken } from '../lib/codes';
import type { Backend, InviteEmail, Query, TableName, Tables } from './backend';
import { buildSeed, DEMO_USERS, type SeedTables } from './seed';
import { weekRange } from '../lib/weeks';
import { saveScore } from './services';
import type { Profile, Role } from './types';

// v6: the venue (map, shop, concessions, restaurants, skills competition).
const STORAGE_KEY = 'cxp-demo-v6';

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
        // Keep the sample users' names current if they changed since this device last saved.
        const demoUser = Object.values(DEMO_USERS).find((u) => u.id === profile?.id);
        if (demoUser && profile) profile = { ...profile, name: demoUser.name };
        db.players.forEach((p) => {
          if (p.guardianEmail === DEMO_USERS.fan.email) p.guardianName = DEMO_USERS.fan.name;
        });
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
    features: { familyAccounts: true, followCodes: true, rosters: true, alerts: true, push: true, meetings: true, photos: true, invites: true, liveStatus: true },

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
      // Like the database's rules: a buyer sees only their own orders and reservations; lodging only for their own children.
      if ((table === 'shop_orders' || table === 'reservations') && profile?.role !== 'director') {
        rows = rows.filter((r) => (r as { userId: string | null }).userId === profile?.id) as never;
      }
      if (table === 'team_lodging' && profile?.role !== 'director') {
        const mine = new Set(db.players.filter((p) => p.guardianEmail && p.guardianEmail === profile?.email).map((p) => p.teamId));
        rows = rows.filter((r) => mine.has((r as { teamId: string }).teamId)) as never;
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
      if (table === 'meeting_bookings') {
        for (const r of rows as Partial<Tables['meeting_bookings']>[]) {
          const slot = db.meeting_slots.find((s) => s.id === r.slotId);
          if (!slot) throw new Error('Session not found');
          if (db.meeting_bookings.some((b) => b.slotId === r.slotId && b.userId === r.userId)) throw new Error('You already booked this session.');
          if (slot.bookedCount >= slot.capacity) throw new Error('This session is full.');
          slot.bookedCount++;
        }
        emit('meeting_slots');
      }
      const created = rows.map((r) => ({ id: `${table}-${randomToken(10)}`, ...r })) as Tables[typeof table][];
      (db[table] as unknown[]).push(...clone(created));
      emit(table);
      return created;
    },

    async update(table, id, patch) {
      const rows = db[table] as { id: string }[];
      const i = rows.findIndex((r) => r.id === id);
      if (i === -1 && (table === 'team_checkins' || table === 'team_lodging' || table === 'venue_settings')) {
        // One check-in per team, created on first save.
        rows.push({ id, ...clone(patch) });
        emit(table);
        return;
      }
      if (i === -1) throw new Error('Not found');
      rows[i] = { ...rows[i], ...clone(patch) };
      emit(table);
    },

    async remove(table, ids) {
      const set = new Set(ids);
      if (table === 'meeting_bookings') {
        for (const b of db.meeting_bookings.filter((x) => set.has(x.id))) {
          const slot = db.meeting_slots.find((s) => s.id === b.slotId);
          if (slot) slot.bookedCount = Math.max(0, slot.bookedCount - 1);
        }
        emit('meeting_slots');
      }
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
        const ev = db.events.find((e) => e.id === team.eventId);
        outbox.unshift({ to: inv.email, name: inv.name, teamName: team.name, week: ev ? `${ev.name} · ${weekRange(ev)}` : '', code: team.code, link: `${appUrl}/follow/${team.code}` });
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

    async placeOrder(input) {
      await readyPromise;
      if (!input.name.trim()) throw new Error('Enter a name for the order.');
      if (input.kind === 'concession' && !input.field.trim()) throw new Error('Pick the field to deliver to.');
      if (!input.items.length) throw new Error('Your cart is empty.');
      const lines = input.items.map((it) => {
        const pr = db.products.find((p) => p.id === it.productId && p.active && p.kind === input.kind);
        if (!pr) throw new Error('Something in your cart isn’t available anymore.');
        if (it.qty < 1 || it.qty > 20) throw new Error('Quantities are 1 to 20.');
        if (pr.sizes.length && !pr.sizes.includes(it.size ?? '')) throw new Error(`Pick a size for ${pr.name}.`);
        return { productId: pr.id, name: pr.name, size: pr.sizes.length ? (it.size ?? '') : '', qty: it.qty, priceCents: pr.priceCents };
      });
      const order = {
        id: `order-${db.shop_orders.length + 101}`,
        kind: input.kind,
        eventId: input.eventId,
        userId: profile?.id ?? null,
        customerName: input.name.trim(),
        customerPhone: input.phone.trim(),
        items: lines,
        totalCents: lines.reduce((s, l) => s + l.qty * l.priceCents, 0),
        deliveryField: input.field.trim(),
        deliverySpot: input.spot.trim(),
        notes: input.notes.trim(),
        status: 'new' as const,
        payment: input.kind === 'concession' ? ('pay_on_delivery' as const) : ('pay_at_pickup' as const),
        pickupCode: randomToken(6).toUpperCase(),
        createdAt: new Date().toISOString(),
      };
      db.shop_orders.push(order);
      emit('shop_orders');
      return { id: order.id, code: order.pickupCode, totalCents: order.totalCents, payment: order.payment };
    },

    async orderStatus(id, code) {
      await readyPromise;
      const o = db.shop_orders.find((x) => x.id === id && x.pickupCode === code.trim().toUpperCase());
      if (!o) throw new Error('No order matches that number and code.');
      return clone(o);
    },

    async requestReservation(input) {
      await readyPromise;
      const r = db.places.find((p) => p.id === input.placeId && p.kind === 'restaurant' && p.takesReservations);
      if (!r) throw new Error('That restaurant doesn’t take reservations in the app.');
      if (!input.name.trim()) throw new Error('Enter a name for the reservation.');
      if (input.partySize < 1 || input.partySize > 40) throw new Error('Party size is 1 to 40.');
      const res = {
        id: `res-${db.reservations.length + 1}`,
        placeId: r.id,
        userId: profile?.id ?? null,
        onDate: input.onDate,
        atTime: input.atTime,
        partySize: input.partySize,
        name: input.name.trim(),
        phone: input.phone.trim(),
        notes: input.notes.trim(),
        status: 'requested' as const,
        code: randomToken(6).toUpperCase(),
        createdAt: new Date().toISOString(),
      };
      db.reservations.push(res);
      emit('reservations');
      return { id: res.id, code: res.code };
    },

    async reservationStatus(id, code) {
      await readyPromise;
      const r = db.reservations.find((x) => x.id === id && x.code === code.trim().toUpperCase());
      if (!r) throw new Error('No reservation matches that number and code.');
      return { id: r.id, status: r.status, onDate: r.onDate, atTime: r.atTime, partySize: r.partySize, restaurant: db.places.find((p) => p.id === r.placeId)?.name ?? '' };
    },

    async uploadImage(file) {
      // Demo: the picture stays on this device.
      return file.uri;
    },

    async umpireGames(code) {
      await readyPromise;
      const uc = db.umpire_codes.find((c) => c.active && c.code === code.trim().toUpperCase());
      const ev = uc && db.events.find((e) => e.id === uc.eventId);
      if (!uc || !ev) throw new Error('That code isn’t right, or it was turned off. Check with the tournament desk.');
      uc.lastUsedAt = new Date().toISOString();
      emit('umpire_codes');
      return {
        event: { id: ev.id, name: ev.name, startsOn: ev.startsOn, endsOn: ev.endsOn, timezone: ev.timezone },
        label: uc.label,
        games: clone(db.games.filter((g) => g.eventId === ev.id).sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.field.localeCompare(b.field, undefined, { numeric: true }))),
        teams: db.teams.filter((t) => t.eventId === ev.id).map((t) => ({ id: t.id, name: t.name })),
      };
    },

    async umpireScore(code, gameId, homeScore, awayScore, baseballs) {
      const uc = db.umpire_codes.find((c) => c.active && c.code === code.trim().toUpperCase());
      const ev = uc && db.events.find((e) => e.id === uc.eventId);
      if (!uc || !ev) throw new Error('That code isn’t right, or it was turned off.');
      uc.lastUsedAt = new Date().toISOString();
      const game = db.games.find((g) => g.id === gameId && g.eventId === ev.id);
      if (!game) throw new Error('That game isn’t in this week.');
      if (!game.homeTeamId || !game.awayTeamId) throw new Error('The teams for this game aren’t known yet.');
      if (game.stage === 'bracket' && homeScore === awayScore) throw new Error('Bracket games can’t end in a tie.');
      await saveScore(backend, clone(game), db.teams, homeScore, awayScore, 'final', baseballs);
    },

    outbox: () => outbox,
  };
  return backend;
}
