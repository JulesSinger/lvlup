-- =====================================================================
--  Sport — les séances de renforcement et de vélo venues de Strava
--  (docs/etude-sport.md §24). À coller dans Supabase Studio > SQL Editor >
--  Run. Idempotent.
--
--  Une table à part plutôt que `sport_runs` : tout ce que Sport calcule sur
--  les sorties (volumes, records, progression, prédiction, Objectifs) est de
--  la course ; une séance de renfo n'y entrerait que pour être filtrée
--  partout. Elle coche la séance du plan qu'elle a faite (`session_id`).
-- =====================================================================

create table if not exists public.sport_activities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  started_at  timestamptz not null,
  day         date not null,
  sport       text not null
              constraint sport_activities_sport_check
              check (sport in ('renfo', 'velo')),
  duration_s  integer not null check (duration_s between 1 and 259200),
  distance_m  integer check (distance_m between 0 and 1000000),
  elevation_m integer check (elevation_m between 0 and 20000),
  avg_hr      smallint check (avg_hr between 30 and 250),
  max_hr      smallint check (max_hr between 30 and 250),
  title       text not null default '' check (char_length(title) <= 120),
  source      text not null default 'strava'
              constraint sport_activities_source_check
              check (source in ('strava', 'manuel')),
  source_ref  text check (char_length(source_ref) between 1 and 200),
  -- La séance du plan qu'elle a cochée ; une séance retirée la laisse sans séance.
  session_id  uuid references public.sport_plan_sessions (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint sport_activities_source_ref_unique unique (user_id, source_ref)
);

create index if not exists sport_activities_user_day_idx on public.sport_activities (user_id, day);

alter table public.sport_activities enable row level security;

drop policy if exists "sport_activities_select_own" on public.sport_activities;
create policy "sport_activities_select_own" on public.sport_activities
  for select using (auth.uid() = user_id);
drop policy if exists "sport_activities_insert_own" on public.sport_activities;
create policy "sport_activities_insert_own" on public.sport_activities
  for insert with check (auth.uid() = user_id);
drop policy if exists "sport_activities_update_own" on public.sport_activities;
create policy "sport_activities_update_own" on public.sport_activities
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "sport_activities_delete_own" on public.sport_activities;
create policy "sport_activities_delete_own" on public.sport_activities
  for delete using (auth.uid() = user_id);
