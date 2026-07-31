-- =====================================================================
--  Zénith — migration : trophées persistants
--  Un trophée débloqué reste débloqué, même si l'action qui l'a obtenu
--  est annulée ensuite.
--  À coller dans Supabase Studio > SQL Editor > Run.
--  Idempotent : peut être relancé sans risque.
-- =====================================================================

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
