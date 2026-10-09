-- Atlas — Sport : le lien avec l'API de Strava (docs/etude-sport.md §21).
--
-- Une ligne par compte relié : l'athlète Strava et les jetons OAuth. Les jetons
-- donnent accès au compte Strava de Jules : **le navigateur n'y touche jamais**.
-- Seule la fonction `sport-strava` lit et écrit cette table, avec la clé de
-- service ; RLS et ses quatre politiques sont là par convention (CLAUDE.md §5),
-- mais les droits du navigateur (anon, authenticated) sont retirés.
--
-- Idempotent : rejouable sans casse.

create table if not exists public.sport_strava_links (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  athlete_id       bigint not null,
  athlete_name     text not null default '' check (char_length(athlete_name) <= 120),
  access_token     text not null check (char_length(access_token) between 1 and 400),
  refresh_token    text not null check (char_length(refresh_token) between 1 and 400),
  expires_at       timestamptz not null,
  scope            text not null default '' check (char_length(scope) <= 200),
  connected_at     timestamptz not null default now(),
  last_sync_at     timestamptz,
  -- Le départ de la dernière activité vue : la prochaine synchronisation repart de là.
  last_activity_at timestamptz
);

alter table public.sport_strava_links enable row level security;

drop policy if exists "sport_strava_links_select_own" on public.sport_strava_links;
create policy "sport_strava_links_select_own" on public.sport_strava_links
  for select using (auth.uid() = user_id);
drop policy if exists "sport_strava_links_insert_own" on public.sport_strava_links;
create policy "sport_strava_links_insert_own" on public.sport_strava_links
  for insert with check (auth.uid() = user_id);
drop policy if exists "sport_strava_links_update_own" on public.sport_strava_links;
create policy "sport_strava_links_update_own" on public.sport_strava_links
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "sport_strava_links_delete_own" on public.sport_strava_links;
create policy "sport_strava_links_delete_own" on public.sport_strava_links
  for delete using (auth.uid() = user_id);

-- Les jetons ne sortent que par la fonction : aucun droit au navigateur.
revoke all on table public.sport_strava_links from anon, authenticated;
