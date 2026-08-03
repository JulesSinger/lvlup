-- =====================================================================
--  Zénith — schéma Supabase
--  À coller dans Supabase Studio > SQL Editor > Run.
--  Idempotent : peut être relancé sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Objectifs
-- ---------------------------------------------------------------------
create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  description text default '',
  emoji       text default '🎯',
  position    integer not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Paliers
-- ---------------------------------------------------------------------
create table if not exists public.tiers (
  id           uuid primary key default gen_random_uuid(),
  goal_id      uuid not null references public.goals (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  rank         text not null check (rank in (
                 'fer','bronze','argent','or','platine',
                 'emeraude','diamant','maitre','grand-maitre','challenger'
               )),
  position     integer not null default 0,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists goals_user_idx on public.goals (user_id, position);
create index if not exists tiers_goal_idx on public.tiers (goal_id, position);
create index if not exists tiers_user_idx on public.tiers (user_id);

-- ---------------------------------------------------------------------
-- Row Level Security : chaque compte ne voit et ne modifie que ses lignes.
-- C'est la garantie côté serveur ; elle tient même si le code client est
-- modifié par un utilisateur malveillant.
-- ---------------------------------------------------------------------
alter table public.goals enable row level security;
alter table public.tiers enable row level security;

drop policy if exists "goals_select_own" on public.goals;
create policy "goals_select_own" on public.goals
  for select using (auth.uid() = user_id);

drop policy if exists "goals_insert_own" on public.goals;
create policy "goals_insert_own" on public.goals
  for insert with check (auth.uid() = user_id);

drop policy if exists "goals_update_own" on public.goals;
create policy "goals_update_own" on public.goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "goals_delete_own" on public.goals;
create policy "goals_delete_own" on public.goals
  for delete using (auth.uid() = user_id);

drop policy if exists "tiers_select_own" on public.tiers;
create policy "tiers_select_own" on public.tiers
  for select using (auth.uid() = user_id);

drop policy if exists "tiers_insert_own" on public.tiers;
create policy "tiers_insert_own" on public.tiers
  for insert with check (auth.uid() = user_id);

drop policy if exists "tiers_update_own" on public.tiers;
create policy "tiers_update_own" on public.tiers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tiers_delete_own" on public.tiers;
create policy "tiers_delete_own" on public.tiers
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Check-ins quotidiens : « aujourd'hui, j'ai fait avancer cet objectif »
-- ---------------------------------------------------------------------
create table if not exists public.checkins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  goal_id    uuid not null references public.goals (id) on delete cascade,
  day        date not null,
  action_id  uuid references public.actions (id) on delete set null,
  pp         integer not null default 10 check (pp between 1 and 100),
  note       text not null default '',
  created_at timestamptz not null default now(),
  -- Une seule réalisation par action et par jour. Contrainte UNIQUE (et non
  -- index partiel) : Postgres n'infère pas un ON CONFLICT depuis un partiel.
  constraint checkins_user_action_day_key unique (user_id, action_id, day)
);

create index if not exists checkins_user_day_idx on public.checkins (user_id, day);

alter table public.checkins enable row level security;

drop policy if exists "checkins_select_own" on public.checkins;
create policy "checkins_select_own" on public.checkins
  for select using (auth.uid() = user_id);

drop policy if exists "checkins_insert_own" on public.checkins;
create policy "checkins_insert_own" on public.checkins
  for insert with check (auth.uid() = user_id);

drop policy if exists "checkins_update_own" on public.checkins;
create policy "checkins_update_own" on public.checkins
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "checkins_delete_own" on public.checkins;
create policy "checkins_delete_own" on public.checkins
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Trophées : un trophée débloqué reste débloqué
-- ---------------------------------------------------------------------
create table if not exists public.achievements (
  user_id        uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null,
  unlocked_at    timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.achievements enable row level security;

drop policy if exists "achievements_select_own" on public.achievements;
create policy "achievements_select_own" on public.achievements
  for select using (auth.uid() = user_id);

drop policy if exists "achievements_insert_own" on public.achievements;
create policy "achievements_insert_own" on public.achievements
  for insert with check (auth.uid() = user_id);

drop policy if exists "achievements_delete_own" on public.achievements;
create policy "achievements_delete_own" on public.achievements
  for delete using (auth.uid() = user_id);
