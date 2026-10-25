-- Local development seed: one tournament week and a director allowlist entry.
-- Replace the email with your own, then sign in with it to get director tools.
insert into public.director_allowlist (email) values ('director@example.com') on conflict do nothing;

insert into public.events (name, starts_on, ends_on, venue, address, check_in_window)
values ('12U Week 1', current_date + 30, current_date + 36, 'Cooperstown, NY', 'Cooperstown, NY 13326', '12:00 PM – 6:00 PM on arrival day');
