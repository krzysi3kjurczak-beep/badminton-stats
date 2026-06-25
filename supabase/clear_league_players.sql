-- Wyczyść wszystkich zawodników, mecze, drużyny i zaproszenia z ligi.
-- Uruchom w Supabase → SQL Editor → Run (jako admin, omija RLS).
--
-- Konta użytkowników usuń osobno: Authentication → Users.
-- Na telefonach: wyczyść dane strony / localStorage albo odinstaluj PWA,
-- żeby stare dane nie wróciły do chmury przy następnym logowaniu.

update public.league_state
set
  payload = jsonb_build_object(
    'stateVersion', 16,
    'players', '[]'::jsonb,
    'teams', '[]'::jsonb,
    'matches', '[]'::jsonb,
    'tombstones', jsonb_build_object(
      'matches', '{}'::jsonb,
      'players', '{}'::jsonb,
      'teams', '{}'::jsonb
    ),
    'signupInvites', '[]'::jsonb
  ),
  updated_at = now()
where league_id = 'default';

-- Jeśli wiersz ligi nie istnieje — utwórz pusty:
insert into public.league_state (league_id, payload)
values (
  'default',
  jsonb_build_object(
    'stateVersion', 16,
    'players', '[]'::jsonb,
    'teams', '[]'::jsonb,
    'matches', '[]'::jsonb,
    'tombstones', jsonb_build_object(
      'matches', '{}'::jsonb,
      'players', '{}'::jsonb,
      'teams', '{}'::jsonb
    ),
    'signupInvites', '[]'::jsonb
  )
)
on conflict (league_id) do nothing;
