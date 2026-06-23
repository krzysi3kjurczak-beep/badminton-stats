-- Liga — wspólny stan meczów / zawodników / drużyn (MVP: jedna liga „default”)
-- Uruchom w Supabase → SQL Editor po schema.sql

create table if not exists public.leagues (
  id text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

insert into public.leagues (id, name)
values ('default', 'Liga')
on conflict (id) do nothing;

create table if not exists public.league_state (
  league_id text primary key references public.leagues (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.league_state enable row level security;

drop policy if exists "league_state_select_auth" on public.league_state;
create policy "league_state_select_auth"
  on public.league_state for select
  to authenticated
  using (true);

drop policy if exists "league_state_insert_auth" on public.league_state;
create policy "league_state_insert_auth"
  on public.league_state for insert
  to authenticated
  with check (true);

drop policy if exists "league_state_update_auth" on public.league_state;
create policy "league_state_update_auth"
  on public.league_state for update
  to authenticated
  using (true)
  with check (true);

create index if not exists league_state_updated_at_idx on public.league_state (updated_at);

-- Realtime (podgląd meczów na żywo; błąd „already member” przy ponownym Run — OK)
do $$
begin
  alter publication supabase_realtime add table public.league_state;
exception
  when duplicate_object then null;
end $$;
