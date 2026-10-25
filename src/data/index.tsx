import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { DEFAULT_TZ, localDateKey } from '../lib/time';
import { pickDefaultEvent } from '../lib/weeks';

import type { Backend, Query, TableName, Tables } from './backend';
import { createDemoBackend } from './demo';
import { createSupabaseBackend } from './supabase';
import type { EventWeek, Profile } from './types';

export const APP_URL =
  process.env.EXPO_PUBLIC_APP_URL ??
  (Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : 'https://cooperstown.example.com');

function makeBackend(): Backend {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createSupabaseBackend(url, key) : createDemoBackend(APP_URL);
}

interface Ctx {
  backend: Backend;
  profile: Profile | null;
  ready: boolean;
  /** Week the user picked, or null to follow the default (current/next week). */
  selectedEventId: string | null;
  selectEvent: (id: string | null) => void;
}

const selectionKey = (userId: string) => `cxp-selected-event:${userId}`;

const BackendContext = createContext<Ctx | null>(null);

export function BackendProvider({ children }: { children: ReactNode }) {
  const [backend] = useState(makeBackend);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Restore the user's last picked week on this device.
  useEffect(() => {
    if (!profile) return;
    let alive = true;
    AsyncStorage.getItem(selectionKey(profile.id))
      .then((id) => alive && setSelectedEventId(id))
      .catch(() => {});
    return () => {
      alive = false;
      setSelectedEventId(null);
    };
  }, [profile]);

  const selectEvent = useCallback(
    (id: string | null) => {
      setSelectedEventId(id);
      if (!profile) return;
      (id ? AsyncStorage.setItem(selectionKey(profile.id), id) : AsyncStorage.removeItem(selectionKey(profile.id))).catch(() => {});
    },
    [profile],
  );

  useEffect(() => {
    const off = backend.onAuthChange(setProfile);
    backend.ready().then(() => {
      setProfile(backend.currentProfile());
      setReady(true);
    });
    return off;
  }, [backend]);

  const value = useMemo(
    () => ({ backend, profile, ready, selectedEventId, selectEvent }),
    [backend, profile, ready, selectedEventId, selectEvent],
  );
  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
}

export function useBackend(): Backend {
  const ctx = useContext(BackendContext);
  if (!ctx) throw new Error('useBackend must be used inside BackendProvider');
  return ctx.backend;
}

export function useAuth() {
  const ctx = useContext(BackendContext);
  if (!ctx) throw new Error('useAuth must be used inside BackendProvider');
  return { profile: ctx.profile, ready: ctx.ready, backend: ctx.backend };
}

export interface Live<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Runs `load` and re-runs it whenever any of `tables` change. `load` should be
 * stable for a given `key`.
 */
export function useLiveQuery<T>(key: string, tables: TableName[], load: (b: Backend) => Promise<T>, initial: T): Live<T> {
  const backend = useBackend();
  const { profile } = useAuth();
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Latest loader without making it a dependency (callers pass inline lambdas).
  const loadRef = useRef(load);
  useLayoutEffect(() => {
    loadRef.current = load;
  });
  const seq = useRef(0);

  const refresh = useCallback(() => {
    const mine = ++seq.current;
    loadRef
      .current(backend)
      .then((d) => {
        if (mine === seq.current) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: Error) => mine === seq.current && setError(e.message))
      .finally(() => mine === seq.current && setLoading(false));
  }, [backend]);

  const tablesKey = tables.join(',');
  useEffect(() => {
    refresh();
    let timer: ReturnType<typeof setTimeout> | null = null;
    // coalesce bursts of changes (bulk inserts) into one reload
    const onChange = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refresh, 150);
    };
    const offs = tablesKey.split(',').map((t) => backend.subscribe(t as TableName, onChange));
    return () => {
      offs.forEach((off) => off());
      if (timer) clearTimeout(timer);
    };
  }, [backend, refresh, key, tablesKey, profile?.id]);

  return { data, loading, error, refresh };
}

export function useTable<K extends TableName>(table: K, query?: Query<Tables[K]>, extraDeps: TableName[] = []): Live<Tables[K][]> {
  const key = `${table}:${JSON.stringify(query ?? {})}`;
  return useLiveQuery(key, [table, ...extraDeps], (b) => b.select(table, query), [] as Tables[K][]);
}

export function useMyFollows() {
  const { profile } = useAuth();
  return useLiveQuery(
    `follows:${profile?.id}`,
    ['follows'],
    async (b) => (profile ? (await b.select('follows', { eq: { userId: profile.id } })).map((f) => f.teamId) : []),
    [] as string[],
  );
}

export function useMyPlayers() {
  const { profile } = useAuth();
  return useLiveQuery(`my-players:${profile?.id}`, ['players'], (b) => (profile ? b.myPlayers() : Promise.resolve([])), []);
}

export interface WeekState extends Live<EventWeek | null> {
  /** Weeks this user can switch between, oldest first. */
  events: EventWeek[];
  /** True when the user picked this week rather than getting the default. */
  pinned: boolean;
  select: (id: string | null) => void;
}

/**
 * The tournament week being viewed. Directors can pick any week; families can
 * pick among the weeks of teams they follow or have a player on. Without a
 * pick, the week happening today (or the next upcoming one) is used.
 */
export function useCurrentEvent(): WeekState {
  const ctx = useContext(BackendContext);
  if (!ctx) throw new Error('useCurrentEvent must be used inside BackendProvider');
  const { profile, selectedEventId, selectEvent } = ctx;
  const follows = useMyFollows();
  const myPlayers = useMyPlayers();
  const teamIds = [...new Set([...follows.data, ...myPlayers.data.map((p) => p.teamId)])].sort();
  const isDirector = profile?.role === 'director';
  const events = useLiveQuery(
    `events:${profile?.role}:${teamIds.join(',')}`,
    ['events', 'follows', 'teams'],
    async (b) => {
      const all = await b.select('events', { order: { column: 'startsOn' } });
      if (isDirector) return all;
      if (teamIds.length === 0) return [];
      const teams = await b.select('teams', { in: { column: 'id', values: teamIds } });
      const ids = new Set(teams.map((t) => t.eventId));
      return all.filter((e) => ids.has(e.id));
    },
    [] as EventWeek[],
  );
  const today = localDateKey(new Date().toISOString(), DEFAULT_TZ);
  const picked = events.data.find((e) => e.id === selectedEventId) ?? null;
  const data = picked ?? pickDefaultEvent(events.data, today);
  return {
    data,
    events: events.data,
    pinned: !!picked,
    select: selectEvent,
    loading: events.loading || follows.loading,
    error: events.error,
    refresh: () => {
      events.refresh();
      follows.refresh();
      myPlayers.refresh();
    },
  };
}
