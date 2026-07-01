-- Wyzeruj ligę globalnie: usuń mecze, drużyny, gości — zostaw tylko zawodników z kontem (authUserId).
-- Uruchom w Supabase → SQL Editor → Run (jako admin, omija RLS).
-- Po deploy v229 klienci z leagueResetAt wymuszą pełne nadpisanie lokalnych danych.

update public.league_state
set
  payload = jsonb_build_object(
    'stateVersion', 22,
    'leagueResetAt', (extract(epoch from now()) * 1000)::bigint,
    'players', coalesce(
      (
        select jsonb_agg(elem order by elem->>'displayName')
        from jsonb_array_elements(payload->'players') elem
        where elem ? 'authUserId'
          and nullif(elem->>'authUserId', '') is not null
      ),
      '[]'::jsonb
    ),
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
