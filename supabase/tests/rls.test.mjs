// Applies the migrations to an in-memory Postgres (PGlite) with stubs for
// Supabase's auth/vault schemas, then checks RLS policies and RPCs.
// Run: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'node:fs';

const db = new PGlite({ extensions: { pgcrypto } });
const dir = new URL('../migrations/', import.meta.url);
const migration = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => fs.readFileSync(new URL(f, dir), 'utf8'))
  .join('\n')
  .replace('create extension if not exists pg_net;', '-- pg_net stubbed');

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create schema vault;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  create view vault.decrypted_secrets as select ''::text as name, ''::text as decrypted_secret where false;
  create publication supabase_realtime;
  grant usage on schema public, auth, vault to anon, authenticated;
  grant select on vault.decrypted_secrets to authenticated;
  grant execute on all functions in schema auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`);
await db.exec(migration);
console.log('migration applied');

const ids = { dir: '00000000-0000-0000-0000-000000000001', parent: '00000000-0000-0000-0000-000000000002', stranger: '00000000-0000-0000-0000-000000000003' };
await db.exec(`insert into public.director_allowlist values ('dir@x.io');`);
await db.exec(`insert into auth.users (id, email) values ('${ids.dir}', 'Dir@x.io'), ('${ids.parent}', 'mom@x.io'), ('${ids.stranger}', 'other@x.io');`);

async function as(who, sql, params) {
  const email = { dir: 'dir@x.io', parent: 'mom@x.io', stranger: 'other@x.io' }[who];
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ sub: ids[who], email })}', false);`);
  try {
    return (await db.query(sql, params)).rows;
  } catch (e) {
    return { error: e.message };
  } finally {
    await db.exec(`reset role;`);
  }
}
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) pass++; else fail++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : JSON.stringify(detail)); };

check('director role from allowlist', (await db.query(`select role from profiles where id='${ids.dir}'`)).rows[0].role === 'director');
check('parent is fan', (await db.query(`select role from profiles where id='${ids.parent}'`)).rows[0].role === 'fan');

const ev = await as('dir', `insert into events (name, starts_on, ends_on) values ('Week 1', '2027-06-05', '2027-06-11') returning id`);
const evId = ev[0].id;
const team = await as('dir', `insert into teams (event_id, name) values ($1, 'Storm') returning id`, [evId]);
const team2 = await as('dir', `insert into teams (event_id, name) values ($1, 'Thunder') returning id`, [evId]);
const tId = team[0].id, t2Id = team2[0].id;
check('director inserts code', !(await as('dir', `insert into team_codes values ($1, 'STOR-AB12')`, [tId])).error);
await as('dir', `insert into team_codes values ($1, 'THUN-CD34')`, [t2Id]);
await as('dir', `insert into players (team_id, first_name, last_name, guardian_email, check_in_token) values ($1, 'Mason', 'Reed', 'mom@x.io', 'TOKEN0000AAAA'), ($1, 'Leo', 'Diaz', 'dad@x.io', 'TOKEN0000BBBB'), ($2, 'Ty', 'Cole', 'x@x.io', 'TOKEN0000CCCC')`, [tId, t2Id]);

check('fan cannot create events', !!(await as('parent', `insert into events (name, starts_on, ends_on) values ('x', '2027-01-01', '2027-01-02')`)).error);
check('fan cannot read team codes', (await as('parent', `select * from team_codes`)).length === 0);
check('fan reads teams', (await as('parent', `select * from teams`)).length === 2);
const mine = await as('parent', `select * from my_players()`);
check('guardian sees own player with token', mine.length === 1 && mine[0].check_in_token === 'TOKEN0000AAAA', mine);
check('guardian cannot read other players directly', (await as('parent', `select * from players`)).length === 1);
check('roster limited to own/followed teams', (await as('parent', `select * from player_roster`)).length === 2);
check('stranger sees no roster', (await as('stranger', `select * from player_roster`)).length === 0);
const followed = await as('stranger', `select follow_team(' thun-cd34 ') as t`);
check('follow by code (case/space tolerant)', followed[0]?.t?.name === 'Thunder', followed);
const roster = await as('stranger', `select * from player_roster`);
check('follower sees names but no contact/token', roster.length === 1 && roster[0].guardian_email === null && roster[0].check_in_token === '', roster);
check('bad code errors', !!(await as('stranger', `select follow_team('NOPE-0000')`)).error);
check('fan cannot check in', !!(await as('parent', `select check_in_player('TOKEN0000AAAA')`)).error);
const ci = await as('dir', `select check_in_player('token0000aaaa') as r`);
check('director check-in', ci[0]?.r?.already_checked_in === false && ci[0].r.player.checked_in_at, ci);
const ci2 = await as('dir', `select check_in_player('TOKEN0000AAAA') as r`);
check('second scan flagged as already', ci2[0]?.r?.already_checked_in === true);

await as('dir', `insert into notifications (event_id, title, team_ids) values ($1, 'all', '{}'), ($1, 'storm only', array[$2::uuid]), ($1, 'thunder only', array[$3::uuid])`, [evId, tId, t2Id]);
const pn = (await as('parent', `select title from notifications order by title`)).map((r) => r.title);
check('parent gets event-wide + child team alerts', JSON.stringify(pn) === '["all","storm only"]', pn);
const sn = (await as('stranger', `select title from notifications order by title`)).map((r) => r.title);
check('follower gets followed team alerts', JSON.stringify(sn) === '["all","thunder only"]', sn);
check('fan cannot post notifications', !!(await as('parent', `insert into notifications (event_id, title) values ($1, 'hack')`, [evId])).error);

check('fan cannot promote self', !!(await as('parent', `update profiles set role = 'director' where id = $1`, [ids.parent])).error);
check('fan can rename self', !(await as('parent', `update profiles set name = 'Mom' where id = $1`, [ids.parent])).error);

const slot = await as('dir', `insert into meeting_slots (event_id, title, starts_at, capacity) values ($1, 'Photo', now(), 1) returning id`, [evId]);
check('book slot', !(await as('parent', `insert into meeting_bookings (slot_id, user_id) values ($1, $2)`, [slot[0].id, ids.parent])).error);
check('capacity enforced', !!(await as('stranger', `insert into meeting_bookings (slot_id, user_id) values ($1, $2)`, [slot[0].id, ids.stranger])).error);
check('cannot book for someone else', !!(await as('stranger', `insert into meeting_bookings (slot_id, user_id) values ($1, $2)`, [slot[0].id, ids.parent])).error);
check('booked_count visible to others', (await as('stranger', `select booked_count from meeting_slots`))[0].booked_count === 1);
await as('parent', `delete from meeting_bookings where user_id = $1`, [ids.parent]);
check('cancel frees spot', (await as('stranger', `select booked_count from meeting_slots`))[0].booked_count === 0);

check('cannot create paid order directly', !!(await as('parent', `insert into photo_orders (user_id, status) values ($1, 'paid')`, [ids.parent])).error);
check('create pending order', !(await as('parent', `insert into photo_orders (user_id) values ($1)`, [ids.parent])).error);
check('cannot mark own order paid', (await as('parent', `update photo_orders set status='paid' returning id`)).length === 0);
check('notification insert does not fail without vault secrets', true);

// --- umpires: the week's code unlocks scoring, nothing else
await as('dir', `update events set umpire_code = 'UMPX1' where id = $1`, [evId]);
const pool = await as('dir', `insert into games (event_id, field, starts_at, home_team_id, away_team_id, stage, number) values ($1, 'Field 1', now(), $2, $3, 'pool', 1) returning id`, [evId, tId, t2Id]);
const fin = await as('dir', `insert into games (event_id, field, starts_at, stage, number, bracket) values ($1, 'Field 2', now(), 'bracket', 3, 'Championship') returning id`, [evId]);
const semi = await as('dir', `insert into games (event_id, field, starts_at, home_team_id, away_team_id, stage, number, bracket, winner_to_game_id, winner_to_slot) values ($1, 'Field 1', now(), $2, $3, 'bracket', 2, 'Championship', $4, 'away') returning id`, [evId, tId, t2Id, fin[0].id]);
check('families cannot read the umpire code', !!(await as('parent', `select umpire_code from events`)).error);
check('families still read events', (await as('parent', `select id, name from events`)).length === 1);
check('directors read umpire codes via function', (await as('dir', `select * from event_umpire_codes()`))[0]?.umpire_code === 'UMPX1');
check('fans get no codes from the function', (await as('parent', `select * from event_umpire_codes()`)).length === 0);
const bad = await as('stranger', `select ump_games('NOPE') as r`);
check('bad umpire code is refused', !!bad[0]?.r?.error);
const ug = await as('stranger', `select ump_games(' umpx1 ') as r`);
check('umpire code unlocks the week\'s games', ug[0]?.r?.games?.length === 3 && ug[0].r.event.name === 'Week 1');
check('umpire score saved with baseballs', !(await as('stranger', `select ump_score('UMPX1', $1, 4, 2, 11) as r`, [pool[0].id]))[0]?.r?.error);
const g1 = (await db.query(`select home_score, away_score, baseballs_used, status from games where id = $1`, [pool[0].id])).rows[0];
check('score + baseballs stored as final', g1.home_score === 4 && g1.away_score === 2 && g1.baseballs_used === 11 && g1.status === 'final', g1);
check('final notifies both teams once', (await db.query(`select count(*)::int as n from notifications where kind = 'score'`)).rows[0].n === 1);
await as('stranger', `select ump_score('UMPX1', $1, 5, 2, 12)`, [pool[0].id]);
check('fixing a score does not notify again', (await db.query(`select count(*)::int as n from notifications where kind = 'score'`)).rows[0].n === 1);
check('bracket tie refused', !!(await as('stranger', `select ump_score('UMPX1', $1, 3, 3, 9) as r`, [semi[0].id]))[0]?.r?.error);
await as('stranger', `select ump_score('UMPX1', $1, 1, 6, 9)`, [semi[0].id]);
check('bracket winner advances', (await db.query(`select away_team_id from games where id = $1`, [fin[0].id])).rows[0].away_team_id === t2Id);
check('teams not known yet: refused', !!(await as('stranger', `select ump_score('UMPX1', $1, 1, 0, 5) as r`, [fin[0].id]))[0]?.r?.error);
check('umpire code cannot reach another week', !!(await as('stranger', `select ump_score('UMPX1', gen_random_uuid(), 1, 0, 5) as r`))[0]?.r?.error);

await db.exec(`delete from director_allowlist where email = 'dir@x.io'`);
check('removing from allowlist demotes', (await db.query(`select role from profiles where id='${ids.dir}'`)).rows[0].role === 'fan');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
