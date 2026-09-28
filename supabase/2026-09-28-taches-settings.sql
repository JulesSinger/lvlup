-- =====================================================================
--  Polaris — migration : réglages des rappels (étape 5)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--  À appliquer avec 2026-09-28-reminders.sql (les rappels communs).
--
--  Les réglages sont en base plutôt que sur l'appareil : chaque appareil
--  recalcule les rappels à venir de Polaris et les dépose dans `reminders`,
--  il faut donc qu'ils partent tous des mêmes réglages — sinon un téléphone
--  qui aurait le rappel du matin coupé effacerait ceux d'un ordinateur qui
--  l'aurait allumé.
-- =====================================================================

create table if not exists public.taches_settings (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  -- Une notification à l'heure d'une tâche qui en a une.
  task_reminders  boolean not null default true,
  -- Le résumé du matin : « 4 tâches aujourd'hui, dont 1 urgente ».
  morning_enabled boolean not null default false,
  morning_time    text not null default '08:00'
                  check (morning_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  updated_at      timestamptz not null default now()
);

alter table public.taches_settings enable row level security;

drop policy if exists "taches_settings_select_own" on public.taches_settings;
create policy "taches_settings_select_own" on public.taches_settings
  for select using (auth.uid() = user_id);
drop policy if exists "taches_settings_insert_own" on public.taches_settings;
create policy "taches_settings_insert_own" on public.taches_settings
  for insert with check (auth.uid() = user_id);
drop policy if exists "taches_settings_update_own" on public.taches_settings;
create policy "taches_settings_update_own" on public.taches_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "taches_settings_delete_own" on public.taches_settings;
create policy "taches_settings_delete_own" on public.taches_settings
  for delete using (auth.uid() = user_id);
