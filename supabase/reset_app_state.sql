-- Wyczyść zapisane dane aplikacji (mecze, zawodnicy, drużyny w JSON).
-- Uruchom w Supabase → SQL Editor po usunięciu użytkowników z Authentication.
-- Wiersze app_state i tak znikają kaskadowo z auth.users — to na wypadek osieroconych rekordów.

delete from public.league_state;
delete from public.app_state;
