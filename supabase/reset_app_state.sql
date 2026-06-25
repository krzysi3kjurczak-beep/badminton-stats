-- Pełny reset danych aplikacji w chmurze (liga + profile).
-- Uruchom w Supabase → SQL Editor po usunięciu użytkowników z Authentication.
-- Tylko zawodnicy/mecze: użyj clear_league_players.sql zamiast tego pliku.
--
-- Wiersze app_state znikają kaskadowo z auth.users — to na wypadek osieroconych rekordów.

delete from public.league_state;
delete from public.app_state;
