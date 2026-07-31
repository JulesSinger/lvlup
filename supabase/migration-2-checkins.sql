-- =====================================================================
--  Zénith — migration Sprint 2 : check-ins quotidiens
--  À coller dans Supabase Studio > SQL Editor > Run.
--  Idempotent : peut être relancé sans risque.
--  (Les projets créés après le Sprint 2 n'en ont pas besoin :
--   supabase/schema.sql contient déjà tout.)
-- =====================================================================

create table if not exists public.checkins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  goal_id    uuid not null references public.goals (id) on delete cascade,
  day        date not null,
  created_at timestamptz not null default now(),
  -- Un seul check-in par objectif et par jour.
  unique (user_id, goal_id, day)
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
