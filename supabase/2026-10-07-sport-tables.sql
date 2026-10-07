-- =====================================================================
--  Sport — migration : tables du module (étape 1)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  La course à pied : sorties, plan marathon par semaines, réglages
--  (fréquence cardiaque), jetons du raccourci iPhone. Conception dans
--  docs/etude-sport.md §7 et §12.
--
--  Distances en MÈTRES et durées en SECONDES, entières : jamais de
--  flottant qu'une addition ferait dériver. L'allure n'est pas stockée,
--  elle se calcule. Les identifiants sont choisis par l'application.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Un plan : une course visée (le marathon d'Annecy), sa date — provisoire
-- tant qu'elle n'est pas officielle —, un temps de référence et le nombre
-- de séances par semaine.
-- ---------------------------------------------------------------------
create table if not exists public.sport_plans (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  title                text not null
                       constraint sport_plans_title_check
                       check (char_length(title) between 1 and 120),
  race_distance_m      integer not null check (race_distance_m between 1000 and 500000),
  race_day             date not null,
  race_day_confirmed   boolean not null default false,
  target_s             integer check (target_s > 0),
  reference_distance_m integer check (reference_distance_m between 1000 and 500000),
  reference_s          integer check (reference_s > 0),
  sessions_per_week    smallint not null default 3
                       constraint sport_plans_sessions_check
                       check (sessions_per_week between 2 and 6),
  start_day            date not null,
  status               text not null default 'actif'
                       constraint sport_plans_status_check
                       check (status in ('actif', 'termine', 'abandonne')),
  created_at           timestamptz not null default now(),
  constraint sport_plans_dates_check check (start_day <= race_day),
  constraint sport_plans_reference_check check ((reference_distance_m is null) = (reference_s is null))
);

create index if not exists sport_plans_user_idx on public.sport_plans (user_id, race_day);

-- ---------------------------------------------------------------------
-- Une séance prévue : elle appartient à une SEMAINE du plan (Jules n'a pas
-- de jours fixes), son jour est facultatif. La sortie qui l'a faite pointe
-- vers elle (sport_runs.session_id).
-- ---------------------------------------------------------------------
create table if not exists public.sport_plan_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  plan_id      uuid not null references public.sport_plans (id) on delete cascade,
  week         smallint not null check (week between 1 and 60),
  position     smallint not null default 0,
  kind         text not null
               constraint sport_plan_sessions_kind_check
               check (kind in ('footing', 'fractionne', 'seuil', 'longue', 'allure', 'course')),
  title        text not null
               constraint sport_plan_sessions_title_check
               check (char_length(title) between 1 and 120),
  distance_m   integer check (distance_m between 100 and 500000),
  duration_s   integer check (duration_s between 60 and 259200),
  pace_min_s   integer check (pace_min_s between 120 and 1200),
  pace_max_s   integer check (pace_max_s between 120 and 1200),
  hr_zone      smallint check (hr_zone between 1 and 5),
  instructions text not null default '' check (char_length(instructions) <= 1000),
  day          date,
  created_at   timestamptz not null default now(),
  constraint sport_plan_sessions_pace_check check (pace_min_s is null or pace_max_s is null or pace_min_s <= pace_max_s)
);

create index if not exists sport_plan_sessions_user_idx on public.sport_plan_sessions (user_id, plan_id, week, position);

-- ---------------------------------------------------------------------
-- Une sortie. `source_ref` (l'identifiant de l'entraînement dans Santé,
-- l'activité Strava d'une archive, le départ d'un fichier) est unique par
-- compte : une même sortie importée deux fois n'existe qu'une fois. NULL
-- pour une saisie à la main (Postgres tient les NULL pour distincts).
-- ---------------------------------------------------------------------
create table if not exists public.sport_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  started_at  timestamptz not null,
  day         date not null,
  distance_m  integer not null check (distance_m between 0 and 500000),
  duration_s  integer not null check (duration_s between 1 and 259200),
  elevation_m integer check (elevation_m between 0 and 20000),
  avg_hr      smallint check (avg_hr between 30 and 250),
  max_hr      smallint check (max_hr between 30 and 250),
  kind        text not null default 'footing'
              constraint sport_runs_kind_check
              check (kind in ('footing', 'fractionne', 'seuil', 'longue', 'allure', 'course', 'autre')),
  effort      smallint check (effort between 1 and 10),
  title       text not null default ''
              constraint sport_runs_title_check
              check (char_length(title) <= 120),
  note        text not null default '' check (char_length(note) <= 2000),
  source      text not null default 'manuel'
              constraint sport_runs_source_check
              check (source in ('manuel', 'raccourci', 'strava', 'gpx', 'tcx', 'fit')),
  source_ref  text check (char_length(source_ref) between 1 and 200),
  session_id  uuid references public.sport_plan_sessions (id) on delete set null,
  -- Les temps au kilomètre, en secondes, quand un fichier les donne.
  splits_s    jsonb check (splits_s is null or jsonb_typeof(splits_s) = 'array'),
  created_at  timestamptz not null default now(),
  constraint sport_runs_source_ref_unique unique (user_id, source_ref)
);

create index if not exists sport_runs_user_idx on public.sport_runs (user_id, started_at);

-- ---------------------------------------------------------------------
-- Les réglages : la fréquence cardiaque (zones de Karvonen) et l'action
-- d'Objectifs que nourrissent les sorties (étape 7). Une ligne par compte.
-- ---------------------------------------------------------------------
create table if not exists public.sport_settings (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  hr_max              smallint check (hr_max between 100 and 250),
  hr_rest             smallint check (hr_rest between 25 and 120),
  objectifs_action_id text check (char_length(objectifs_action_id) <= 100),
  updated_at          timestamptz not null default now(),
  constraint sport_settings_hr_check check (hr_max is null or hr_rest is null or hr_rest < hr_max)
);

-- ---------------------------------------------------------------------
-- Les jetons du raccourci iPhone (étape 5) : seule leur EMPREINTE est
-- rangée (SHA-256), comme un mot de passe — le jeton n'est montré qu'une
-- fois, à sa création. La fonction `sport-import` le vérifie par empreinte.
-- ---------------------------------------------------------------------
create table if not exists public.sport_import_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  token_hash   text not null unique check (char_length(token_hash) = 64),
  label        text not null default '' check (char_length(label) <= 80),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists sport_import_tokens_user_idx on public.sport_import_tokens (user_id);

-- ---------------------------------------------------------------------
-- Row Level Security : chaque compte ne voit et ne modifie que ses lignes.
-- Motif copié de schema.sql — quatre politiques par table.
-- ---------------------------------------------------------------------
alter table public.sport_plans enable row level security;
alter table public.sport_plan_sessions enable row level security;
alter table public.sport_runs enable row level security;
alter table public.sport_settings enable row level security;
alter table public.sport_import_tokens enable row level security;

drop policy if exists "sport_plans_select_own" on public.sport_plans;
create policy "sport_plans_select_own" on public.sport_plans
  for select using (auth.uid() = user_id);
drop policy if exists "sport_plans_insert_own" on public.sport_plans;
create policy "sport_plans_insert_own" on public.sport_plans
  for insert with check (auth.uid() = user_id);
drop policy if exists "sport_plans_update_own" on public.sport_plans;
create policy "sport_plans_update_own" on public.sport_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "sport_plans_delete_own" on public.sport_plans;
create policy "sport_plans_delete_own" on public.sport_plans
  for delete using (auth.uid() = user_id);

drop policy if exists "sport_plan_sessions_select_own" on public.sport_plan_sessions;
create policy "sport_plan_sessions_select_own" on public.sport_plan_sessions
  for select using (auth.uid() = user_id);
drop policy if exists "sport_plan_sessions_insert_own" on public.sport_plan_sessions;
create policy "sport_plan_sessions_insert_own" on public.sport_plan_sessions
  for insert with check (auth.uid() = user_id);
drop policy if exists "sport_plan_sessions_update_own" on public.sport_plan_sessions;
create policy "sport_plan_sessions_update_own" on public.sport_plan_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "sport_plan_sessions_delete_own" on public.sport_plan_sessions;
create policy "sport_plan_sessions_delete_own" on public.sport_plan_sessions
  for delete using (auth.uid() = user_id);

drop policy if exists "sport_runs_select_own" on public.sport_runs;
create policy "sport_runs_select_own" on public.sport_runs
  for select using (auth.uid() = user_id);
drop policy if exists "sport_runs_insert_own" on public.sport_runs;
create policy "sport_runs_insert_own" on public.sport_runs
  for insert with check (auth.uid() = user_id);
drop policy if exists "sport_runs_update_own" on public.sport_runs;
create policy "sport_runs_update_own" on public.sport_runs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "sport_runs_delete_own" on public.sport_runs;
create policy "sport_runs_delete_own" on public.sport_runs
  for delete using (auth.uid() = user_id);

drop policy if exists "sport_settings_select_own" on public.sport_settings;
create policy "sport_settings_select_own" on public.sport_settings
  for select using (auth.uid() = user_id);
drop policy if exists "sport_settings_insert_own" on public.sport_settings;
create policy "sport_settings_insert_own" on public.sport_settings
  for insert with check (auth.uid() = user_id);
drop policy if exists "sport_settings_update_own" on public.sport_settings;
create policy "sport_settings_update_own" on public.sport_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "sport_settings_delete_own" on public.sport_settings;
create policy "sport_settings_delete_own" on public.sport_settings
  for delete using (auth.uid() = user_id);

drop policy if exists "sport_import_tokens_select_own" on public.sport_import_tokens;
create policy "sport_import_tokens_select_own" on public.sport_import_tokens
  for select using (auth.uid() = user_id);
drop policy if exists "sport_import_tokens_insert_own" on public.sport_import_tokens;
create policy "sport_import_tokens_insert_own" on public.sport_import_tokens
  for insert with check (auth.uid() = user_id);
drop policy if exists "sport_import_tokens_update_own" on public.sport_import_tokens;
create policy "sport_import_tokens_update_own" on public.sport_import_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "sport_import_tokens_delete_own" on public.sport_import_tokens;
create policy "sport_import_tokens_delete_own" on public.sport_import_tokens
  for delete using (auth.uid() = user_id);
