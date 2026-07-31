-- =====================================================================
--  Palier — schéma Supabase
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
