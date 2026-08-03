-- =====================================================================
--  Zénith — migration : actions du quotidien + objectif du jour
--
--  Ce script est SANS PERTE :
--   · les check-ins existants sont conservés tels quels et gardent 10 PP ;
--   · chaque objectif déjà créé reçoit ses deux actions génériques ;
--   · rien n'est supprimé, aucun trophée ni aucune courbe n'est réécrit.
--
--  À coller dans Supabase Studio > SQL Editor > Run.
--  Idempotent : peut être relancé sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Les actions : le menu du quotidien, rattaché à un objectif
-- ---------------------------------------------------------------------
create table if not exists public.actions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  goal_id    uuid not null references public.goals (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 80),
  pp         integer not null default 10 check (pp between 1 and 100),
  position   integer not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists actions_goal_idx on public.actions (goal_id, position);

alter table public.actions enable row level security;

drop policy if exists "actions_select_own" on public.actions;
create policy "actions_select_own" on public.actions
  for select using (auth.uid() = user_id);

drop policy if exists "actions_insert_own" on public.actions;
create policy "actions_insert_own" on public.actions
  for insert with check (auth.uid() = user_id);

drop policy if exists "actions_update_own" on public.actions;
create policy "actions_update_own" on public.actions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "actions_delete_own" on public.actions;
create policy "actions_delete_own" on public.actions
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 2. Les réalisations pointent désormais vers une action et figent leurs PP
--
--    `on delete set null` : supprimer une action laisse ses réalisations
--    passées dans l'historique, avec les PP qu'elles valaient ce jour-là.
-- ---------------------------------------------------------------------
alter table public.checkins
  add column if not exists action_id uuid references public.actions (id) on delete set null;

alter table public.checkins
  add column if not exists pp integer not null default 10 check (pp between 1 and 100);

-- L'unicité change : une réalisation par ACTION et par jour (au lieu d'une
-- par objectif et par jour). Il faut une vraie contrainte UNIQUE et non un
-- index partiel : Postgres refuse d'inférer un ON CONFLICT depuis un index
-- partiel. Les anciennes lignes sans action ne gênent pas — deux NULL sont
-- considérés distincts, elles ne peuvent pas entrer en conflit entre elles.
alter table public.checkins drop constraint if exists checkins_user_id_goal_id_day_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'checkins_user_action_day_key'
  ) then
    alter table public.checkins
      add constraint checkins_user_action_day_key unique (user_id, action_id, day);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. Le profil : l'objectif de PP quotidien, synchronisé entre appareils
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  daily_goal integer not null default 40 check (daily_goal between 5 and 1000),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 4. Rattrapage : les objectifs déjà créés reçoivent leurs deux actions
--    (uniquement ceux qui n'en ont aucune — relançable sans doublon)
-- ---------------------------------------------------------------------
insert into public.actions (user_id, goal_id, title, pp, position)
select g.user_id, g.id, 'Un vrai effort', 15, 0
from public.goals g
where not exists (select 1 from public.actions a where a.goal_id = g.id);

insert into public.actions (user_id, goal_id, title, pp, position)
select g.user_id, g.id, 'Un petit pas', 5, 1
from public.goals g
where not exists (
  select 1 from public.actions a where a.goal_id = g.id and a.position = 1
);
