// The Cooperstown backend's player, QR pass and check-in calls, against a stand-in for the database's REST API.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native-url-polyfill/auto', () => ({}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: async (k: string) => store.get(k) ?? null,
      setItem: async (k: string, v: string) => void store.set(k, v),
      removeItem: async (k: string) => void store.delete(k),
    },
  };
});

const URL_BASE = 'https://db.test';
const ROW = {
  id: 'p1',
  team_id: 't1',
  first_name: 'Sam',
  last_name: 'Reed',
  jersey_number: '7',
  guardian_name: 'Libby Reed',
  guardian_email: 'libby@family.test',
  guardian_phone: '',
  check_in_token: 'A1B2C3D4E5F60718293A',
  checked_in_at: null,
  checked_in_by: '',
  external_id: '',
};

type Call = { method: string; url: URL; body: unknown };
let calls: Call[] = [];
let respond: (c: Call) => unknown;

beforeEach(() => {
  calls = [];
  respond = () => [];
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const call = { method: init?.method ?? 'GET', url, body };
    calls.push(call);
    const accept = new Headers(init?.headers).get('Accept') ?? '';
    let data = respond(call);
    // .single() asks for one object
    if (accept.includes('vnd.pgrst.object') && Array.isArray(data)) data = data[0];
    return new Response(JSON.stringify(data ?? null), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
});

async function backend() {
  const { createCooperstownBackend } = await import('../cooperstown');
  const b = createCooperstownBackend(URL_BASE, 'sb_publishable_test');
  await b.ready();
  return b;
}

describe('Cooperstown backend: players and QR check-in', () => {
  it('turns on rosters and parent sign-in', async () => {
    const b = await backend();
    expect(b.features.rosters).toBe(true);
    expect(b.features.familyAccounts).toBe(true);
    expect(typeof b.sendSignInCode).toBe('function');
  });

  it('adds players without a client-made token, so the database makes an unguessable one', async () => {
    const b = await backend();
    respond = (c) => (c.url.pathname === '/rest/v1/players' && c.method === 'POST' ? [ROW] : []);
    const [p] = await b.insert('players', [
      { teamId: 't1', firstName: ' Sam ', lastName: 'Reed', jerseyNumber: '7', guardianEmail: 'Libby@Family.test', checkInToken: 'client-made', checkedInAt: null, checkedInBy: null },
    ]);
    const post = calls.find((c) => c.method === 'POST' && c.url.pathname === '/rest/v1/players')!;
    expect(post.body).toEqual([{ team_id: 't1', first_name: 'Sam', last_name: 'Reed', jersey_number: '7', guardian_email: 'libby@family.test' }]);
    expect(p).toMatchObject({ id: 'p1', firstName: 'Sam', checkInToken: ROW.check_in_token, jerseyNumber: '7' });
  });

  it('checks a scanned pass in through check_in_player and reports a second scan', async () => {
    const b = await backend();
    let already = false;
    respond = (c) => {
      if (c.url.pathname === '/rest/v1/rpc/check_in_player') {
        const out = { ok: true, alreadyCheckedIn: already, player: { id: 'p1', firstName: 'Sam', lastName: 'Reed', jersey: '7', checkedInAt: '2027-05-30T16:00:00Z' }, team: { id: 't1', name: 'Storm', weekId: 'w1' } };
        already = true;
        return out;
      }
      if (c.url.pathname === '/rest/v1/players') return [{ ...ROW, checked_in_at: '2027-05-30T16:00:00Z', checked_in_by: 'Desk' }];
      if (c.url.pathname === '/rest/v1/teams') return [{ id: 't1', week_id: 'w1', age_group: '12U', name: 'Storm', organization: '', city: '', state: 'FL', players: 12, coaches: 2 }];
      return [];
    };
    const first = await b.checkInByToken(ROW.check_in_token);
    expect(calls.find((c) => c.url.pathname === '/rest/v1/rpc/check_in_player')!.body).toEqual({ p_token: ROW.check_in_token });
    expect(first.alreadyCheckedIn).toBe(false);
    expect(first.player.checkedInBy).toBe('Desk');
    expect(first.team?.name).toBe('Storm');
    expect((await b.checkInByToken(ROW.check_in_token)).alreadyCheckedIn).toBe(true);
  });

  it('shows the database’s message for a pass that isn’t ours', async () => {
    const b = await backend();
    respond = () => ({ error: 'That QR code isn’t one of ours.' });
    await expect(b.checkInByToken('NOTATOKEN1234')).rejects.toThrow('That QR code isn’t one of ours.');
  });

  it('gives guests no players and asks the database for a team roster without passes', async () => {
    const b = await backend();
    await b.continueAsGuest!();
    expect(await b.select('players')).toEqual([]);
    respond = (c) => (c.url.pathname === '/rest/v1/rpc/team_roster' ? [{ id: 'p1', first_name: 'Sam', last_initial: 'R', jersey_number: '7', checked_in: true }] : []);
    const roster = await b.select('players', { eq: { teamId: 't1' } });
    expect(roster).toEqual([expect.objectContaining({ firstName: 'Sam', lastName: 'R.', checkInToken: '', guardianEmail: null })]);
    expect(calls.some((c) => c.url.pathname === '/rest/v1/players')).toBe(false);
  });

  it('sends parents a sign-in code and verifies it', async () => {
    const b = await backend();
    respond = (c) =>
      c.url.pathname === '/auth/v1/verify'
        ? { access_token: 'a', refresh_token: 'r', expires_in: 3600, token_type: 'bearer', user: { id: 'u1', email: 'libby@family.test', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '' } }
        : c.url.pathname === '/rest/v1/staff'
          ? []
          : {};
    await b.sendSignInCode!(' Libby@Family.test ');
    const otp = calls.find((c) => c.url.pathname === '/auth/v1/otp')!;
    expect(otp.body).toMatchObject({ email: 'libby@family.test', create_user: true });
    await b.verifySignInCode!('libby@family.test', '123456');
    expect(calls.find((c) => c.url.pathname === '/auth/v1/verify')!.body).toMatchObject({ email: 'libby@family.test', token: '123456', type: 'email' });
    expect(b.currentProfile()).toMatchObject({ id: 'u1', role: 'fan', email: 'libby@family.test' });
  });
});
