-- Cooperstown Experience: initial schema
--
-- Roles: every signed-in user has a profile. Directors are promoted by adding
-- their email to director_allowlist (before or after they first sign in).
-- Families see rosters only for teams they follow; contact details and
-- check-in tokens are visible only to directors and the player's guardian.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles & roles

create table public.director_allowlist (
  email text primary key check (email = lower(email))
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  name text not null default '',
  role text not null default 'fan' check (role in ('fan', 'coach', 'director')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.director_allowlist a where a.email = lower(new.email)) then 'director' else 'fan' end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Allowlisting an existing user promotes them immediately.
create or replace function public.sync_director_allowlist() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set role = 'director' where email = new.email;
  elsif tg_op = 'DELETE' then
    update public.profiles set role = 'fan' where email = old.email and role = 'director';
  end if;
  return null;
end $$;

create trigger director_allowlist_sync after insert or delete on public.director_allowlist
  for each row execute function public.sync_director_allowlist();

create or replace function public.is_director() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'director');
$$;

create or replace function public.auth_email() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- ---------------------------------------------------------------------------
-- Events, teams, players

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  venue text not null default '',
  address text not null default '',
  latitude double precision not null default 42.7006,
  longitude double precision not null default -74.9243,
  check_in_window text not null default '',
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  name text not null,
  city text not null default '',
  state text not null default '',
  pool text,
  coach_name text,
  coach_email text,
  coach_phone text,
  external_id text,
  created_at timestamptz not null default now()
);
create index teams_event_idx on public.teams (event_id);

-- Follow codes are kept apart from teams so only directors can read them.
create table public.team_codes (
  team_id uuid primary key references public.teams on delete cascade,
  code text not null unique check (code = upper(code))
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams on delete cascade,
  first_name text not null,
  last_name text not null default '',
  jersey_number text,
  birth_date date,
  guardian_name text,
  guardian_email text check (guardian_email is null or guardian_email = lower(guardian_email)),
  guardian_phone text,
  check_in_token text not null unique default upper(encode(gen_random_bytes(10), 'hex')),
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users,
  external_id text,
  created_at timestamptz not null default now()
);
create index players_team_idx on public.players (team_id);
create index players_guardian_idx on public.players (guardian_email);

create table public.follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  team_id uuid not null references public.teams on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, team_id)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams on delete cascade,
  email text not null check (email = lower(email)),
  name text,
  sent_at timestamptz,
  unique (team_id, email)
);

-- Teams the current user cares about: followed teams plus their children's teams.
create or replace function public.my_team_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select team_id from public.follows where user_id = auth.uid()
  union
  select team_id from public.players where guardian_email = public.auth_email() and public.auth_email() <> '';
$$;

-- ---------------------------------------------------------------------------
-- Games & notifications

create table public.games (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  field text not null,
  starts_at timestamptz not null,
  home_team_id uuid references public.teams on delete set null,
  away_team_id uuid references public.teams on delete set null,
  home_label text,
  away_label text,
  home_score int check (home_score >= 0),
  away_score int check (away_score >= 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'final', 'delayed', 'postponed', 'cancelled')),
  stage text not null default 'pool' check (stage in ('pool', 'bracket')),
  round text,
  number int not null default 0,
  winner_to_game_id uuid references public.games on delete set null,
  winner_to_slot text check (winner_to_slot in ('home', 'away')),
  note text,
  updated_at timestamptz not null default now()
);
create index games_event_idx on public.games (event_id, starts_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  kind text not null default 'general' check (kind in ('general', 'weather', 'schedule', 'score', 'checkin')),
  title text not null check (length(title) between 1 and 120),
  body text not null default '' check (length(body) <= 2000),
  team_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users
);
create index notifications_event_idx on public.notifications (event_id, created_at desc);

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users on delete cascade,
  platform text not null default '',
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Meetings

create table public.meeting_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  title text not null,
  description text not null default '',
  location text not null default '',
  starts_at timestamptz not null,
  duration_minutes int not null default 15 check (duration_minutes > 0),
  capacity int not null default 1 check (capacity > 0),
  booked_count int not null default 0
);

create table public.meeting_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.meeting_slots on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  player_id uuid references public.players on delete set null,
  name text not null default '',
  note text,
  created_at timestamptz not null default now(),
  unique (slot_id, user_id)
);

create or replace function public.meeting_booking_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s public.meeting_slots;
begin
  if tg_op = 'INSERT' then
    select * into s from public.meeting_slots where id = new.slot_id for update;
    if s.booked_count >= s.capacity then
      raise exception 'This session is full.';
    end if;
    update public.meeting_slots set booked_count = booked_count + 1 where id = new.slot_id;
    return new;
  else
    update public.meeting_slots set booked_count = greatest(0, booked_count - 1) where id = old.slot_id;
    return old;
  end if;
end $$;

create trigger meeting_booking_count_ins before insert on public.meeting_bookings
  for each row execute function public.meeting_booking_count();
create trigger meeting_booking_count_del after delete on public.meeting_bookings
  for each row execute function public.meeting_booking_count();

-- ---------------------------------------------------------------------------
-- Photos

create table public.photo_products (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events on delete cascade,
  name text not null,
  description text not null default '',
  price_cents int not null check (price_cents > 0),
  kind text not null default 'print' check (kind in ('print', 'digital', 'bundle')),
  active boolean not null default true
);

create table public.photo_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  player_id uuid references public.players on delete set null,
  items jsonb not null default '[]',
  total_cents int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'paid', 'fulfilled', 'cancelled')),
  stripe_session_id text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row-level security

alter table public.director_allowlist enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.teams enable row level security;
alter table public.team_codes enable row level security;
alter table public.players enable row level security;
alter table public.follows enable row level security;
alter table public.invites enable row level security;
alter table public.games enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.meeting_slots enable row level security;
alter table public.meeting_bookings enable row level security;
alter table public.photo_products enable row level security;
alter table public.photo_orders enable row level security;

create policy "directors manage allowlist" on public.director_allowlist for all using (public.is_director()) with check (public.is_director());

create policy "read own profile or director" on public.profiles for select using (id = auth.uid() or public.is_director());
create policy "update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- Users may only change their display name, never their role.
revoke update on public.profiles from authenticated;
grant update (name) on public.profiles to authenticated;

create policy "signed-in read events" on public.events for select to authenticated using (true);
create policy "directors write events" on public.events for all using (public.is_director()) with check (public.is_director());

create policy "signed-in read teams" on public.teams for select to authenticated using (true);
create policy "directors write teams" on public.teams for all using (public.is_director()) with check (public.is_director());

create policy "directors manage codes" on public.team_codes for all using (public.is_director()) with check (public.is_director());

create policy "directors manage players" on public.players for all using (public.is_director()) with check (public.is_director());
create policy "guardians read own players" on public.players for select using (guardian_email = public.auth_email() and public.auth_email() <> '');

create policy "read own follows" on public.follows for select using (user_id = auth.uid() or public.is_director());
create policy "delete own follows" on public.follows for delete using (user_id = auth.uid());

create policy "directors manage invites" on public.invites for all using (public.is_director()) with check (public.is_director());

create policy "signed-in read games" on public.games for select to authenticated using (true);
create policy "directors write games" on public.games for all using (public.is_director()) with check (public.is_director());

create policy "read relevant notifications" on public.notifications for select using (
  public.is_director()
  or team_ids = '{}'
  or team_ids && array(select public.my_team_ids())
);
create policy "directors write notifications" on public.notifications for all using (public.is_director()) with check (public.is_director());

create policy "own push tokens" on public.push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "signed-in read slots" on public.meeting_slots for select to authenticated using (true);
create policy "directors write slots" on public.meeting_slots for all using (public.is_director()) with check (public.is_director());

create policy "read own bookings" on public.meeting_bookings for select using (user_id = auth.uid() or public.is_director());
create policy "book for self" on public.meeting_bookings for insert with check (user_id = auth.uid());
create policy "cancel own booking" on public.meeting_bookings for delete using (user_id = auth.uid() or public.is_director());

create policy "signed-in read products" on public.photo_products for select to authenticated using (true);
create policy "directors write products" on public.photo_products for all using (public.is_director()) with check (public.is_director());

create policy "read own orders" on public.photo_orders for select using (user_id = auth.uid() or public.is_director());
create policy "create own pending order" on public.photo_orders for insert with check (user_id = auth.uid() and status = 'pending');
create policy "directors update orders" on public.photo_orders for update using (public.is_director()) with check (public.is_director());

-- ---------------------------------------------------------------------------
-- Roster view for families: names and jersey numbers only, for teams they follow.

create view public.player_roster with (security_barrier) as
  select
    p.id,
    p.team_id,
    p.first_name,
    p.last_name,
    p.jersey_number,
    null::date as birth_date,
    null::text as guardian_name,
    null::text as guardian_email,
    null::text as guardian_phone,
    ''::text as check_in_token,
    p.checked_in_at,
    null::uuid as checked_in_by,
    null::text as external_id
  from public.players p
  where public.is_director() or p.team_id in (select public.my_team_ids());

grant select on public.player_roster to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs

create or replace function public.follow_team(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare
  t public.teams;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first.';
  end if;
  select tm.* into t from public.teams tm join public.team_codes c on c.team_id = tm.id where c.code = upper(trim(p_code));
  if not found then
    raise exception 'No team found for code %.', upper(trim(p_code));
  end if;
  insert into public.follows (user_id, team_id) values (auth.uid(), t.id) on conflict do nothing;
  return row_to_json(t);
end $$;

create or replace function public.my_players() returns setof public.players
language sql stable security invoker set search_path = public as $$
  select * from public.players where guardian_email = public.auth_email() and public.auth_email() <> '' order by first_name;
$$;

create or replace function public.check_in_player(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare
  p public.players;
  t public.teams;
  already boolean;
begin
  if not public.is_director() then
    raise exception 'Directors only.';
  end if;
  select * into p from public.players where check_in_token = upper(trim(p_token)) for update;
  if not found then
    raise exception 'QR code not recognized for this event.';
  end if;
  already := p.checked_in_at is not null;
  if not already then
    update public.players set checked_in_at = now(), checked_in_by = auth.uid() where id = p.id returning * into p;
  end if;
  select * into t from public.teams where id = p.team_id;
  return json_build_object('player', row_to_json(p), 'team', row_to_json(t), 'already_checked_in', already);
end $$;

revoke execute on function public.follow_team(text) from anon;
revoke execute on function public.check_in_player(text) from anon;
revoke execute on function public.my_players() from anon;

-- ---------------------------------------------------------------------------
-- Push fan-out: every new notification row calls the push-dispatch function.
-- Requires two Vault secrets (see README): project_url and service_role_key.

create extension if not exists pg_net;

create or replace function public.dispatch_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base_url text;
  key text;
begin
  select decrypted_secret into base_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into key from vault.decrypted_secrets where name = 'service_role_key';
  if base_url is null or key is null then
    raise warning 'push not sent: vault secrets project_url / service_role_key are missing';
    return new;
  end if;
  perform net.http_post(
    url := base_url || '/functions/v1/push-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || key),
    body := jsonb_build_object('record', row_to_json(new))
  );
  return new;
end $$;

create trigger notifications_push after insert on public.notifications
  for each row execute function public.dispatch_push();

-- ---------------------------------------------------------------------------
-- Realtime: live scores, schedule changes and alerts.

alter publication supabase_realtime add table public.games, public.notifications, public.teams, public.players, public.follows, public.meeting_slots, public.meeting_bookings, public.photo_orders, public.invites, public.events, public.photo_products;
