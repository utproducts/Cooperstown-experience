-- Whole-week schedules, team organizations, umpire scoring and baseball counts.

alter table public.teams add column organization text, add column roster_size int;
alter table public.games add column home_seed int, add column away_seed int, add column baseballs_used int check (baseballs_used between 0 and 500);
alter table public.events add column umpire_code text unique check (umpire_code = upper(umpire_code));

-- Families must not see the umpire code: column-level grant on events.
revoke select on public.events from authenticated;
grant select (id, name, starts_on, ends_on, venue, address, latitude, longitude, check_in_window, timezone, created_at) on public.events to authenticated;
-- Directors read the codes through this function.
create or replace function public.event_umpire_codes() returns table (id uuid, umpire_code text)
language sql stable security definer set search_path = public as $$
  select e.id, e.umpire_code from public.events e where public.is_director();
$$;

-- Umpires: no account. The week's code unlocks that week's games and nothing else.
create or replace function public.ump_games(p_code text) returns json
language plpgsql stable security definer set search_path = public as $$
declare
  e public.events;
begin
  select * into e from public.events where umpire_code = upper(trim(p_code));
  if not found then
    return json_build_object('error', 'That umpire code isn''t valid. Check with the tournament director.');
  end if;
  return json_build_object(
    'event', json_build_object('id', e.id, 'name', e.name, 'starts_on', e.starts_on, 'ends_on', e.ends_on, 'timezone', e.timezone),
    'games', coalesce((select json_agg(row_to_json(g) order by g.starts_at, g.field) from public.games g where g.event_id = e.id), '[]'::json),
    'teams', coalesce((select json_agg(json_build_object('id', t.id, 'name', t.name)) from public.teams t where t.event_id = e.id), '[]'::json)
  );
end $$;

-- Saves a final score (and baseballs used) for a game in the code's week: notifies both teams the first time it goes
-- final and moves a bracket winner into their next game.
create or replace function public.ump_score(p_code text, p_game uuid, p_home int, p_away int, p_balls int) returns json
language plpgsql security definer set search_path = public as $$
declare
  e public.events;
  g public.games;
  was_final boolean;
  winner uuid;
  home_name text;
  away_name text;
begin
  select * into e from public.events where umpire_code = upper(trim(p_code));
  if not found then return json_build_object('error', 'That umpire code isn''t valid.'); end if;
  select * into g from public.games where id = p_game and event_id = e.id for update;
  if not found then return json_build_object('error', 'That game isn''t in this week.'); end if;
  if g.home_team_id is null or g.away_team_id is null then return json_build_object('error', 'The teams for this game aren''t known yet.'); end if;
  if p_home is null or p_away is null or p_home < 0 or p_away < 0 or p_home > 99 or p_away > 99 then return json_build_object('error', 'Enter both scores (0–99).'); end if;
  if g.stage = 'bracket' and p_home = p_away then return json_build_object('error', 'Bracket games can''t end in a tie.'); end if;
  if p_balls is not null and (p_balls < 0 or p_balls > 500) then return json_build_object('error', 'Baseballs used must be 0–500.'); end if;
  was_final := g.status = 'final';
  update public.games set home_score = p_home, away_score = p_away, baseballs_used = p_balls, status = 'final', updated_at = now() where id = g.id;
  if g.stage = 'bracket' and g.winner_to_game_id is not null then
    winner := case when p_home > p_away then g.home_team_id else g.away_team_id end;
    if g.winner_to_slot = 'home' then update public.games set home_team_id = winner where id = g.winner_to_game_id;
    else update public.games set away_team_id = winner where id = g.winner_to_game_id; end if;
  end if;
  if not was_final then
    select name into home_name from public.teams where id = g.home_team_id;
    select name into away_name from public.teams where id = g.away_team_id;
    insert into public.notifications (event_id, kind, title, body, team_ids)
    values (e.id, 'score', format('Final: %s %s, %s %s', away_name, p_away, home_name, p_home),
            format('G%s on %s%s', g.number, g.field, coalesce(' · ' || g.bracket || ' bracket', '')), array[g.home_team_id, g.away_team_id]);
  end if;
  return json_build_object('ok', true);
end $$;

grant execute on function public.ump_games(text) to anon, authenticated;
grant execute on function public.ump_score(text, uuid, int, int, int) to anon, authenticated;
