-- Multiple brackets per week (Cooperstown: Championship, Monster, Cooper).
alter table public.games add column bracket text;
create index games_bracket_idx on public.games (event_id, stage, bracket);
