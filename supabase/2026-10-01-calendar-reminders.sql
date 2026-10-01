-- =====================================================================
--  Éclipse — migration : les rappels des événements
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--  Suppose appliquées 2026-09-27-calendar-tables.sql et
--  2026-09-28-reminders.sql (les rappels communs du socle).
--
--  Le calendrier calcule ses rappels et les déclare au socle, qui les
--  envoie (`send-reminders`, au passage du cron) : aucune fonction nouvelle.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Les rappels d'un événement, en minutes avant son début, deux au plus.
-- Nulle : ceux par défaut des réglages (un événement d'avant cette
-- migration suit donc le défaut) ; vide : aucun rappel, choisi.
-- En journée entière, le début est minuit : 360 = la veille à 18 h,
-- −480 = le jour même à 8 h. Pendant de `REMINDER_OFFSETS` (lib/types.ts).
-- ---------------------------------------------------------------------
alter table public.calendar_events add column if not exists reminders integer[];

alter table public.calendar_events drop constraint if exists calendar_events_reminders_check;
alter table public.calendar_events add constraint calendar_events_reminders_check
  check (reminders is null or (cardinality(reminders) <= 2 and reminders <@ array[-480, 0, 5, 10, 15, 30, 60, 120, 360, 1440]));

-- ---------------------------------------------------------------------
-- Les rappels par défaut, une ligne par compte. En base plutôt que sur
-- l'appareil : chaque appareil recalcule les rappels du compte et les
-- dépose dans `reminders`, il faut qu'ils partent des mêmes réglages
-- (même raison que `taches_settings`).
-- ---------------------------------------------------------------------
create table if not exists public.calendar_settings (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  timed_reminders   integer[] not null default '{15}'
                    check (cardinality(timed_reminders) <= 2 and timed_reminders <@ array[0, 5, 10, 15, 30, 60, 120, 1440]),
  all_day_reminders integer[] not null default '{}'
                    check (cardinality(all_day_reminders) <= 2 and all_day_reminders <@ array[-480, 360]),
  updated_at        timestamptz not null default now()
);

alter table public.calendar_settings enable row level security;

drop policy if exists "calendar_settings_select_own" on public.calendar_settings;
create policy "calendar_settings_select_own" on public.calendar_settings
  for select using (auth.uid() = user_id);
drop policy if exists "calendar_settings_insert_own" on public.calendar_settings;
create policy "calendar_settings_insert_own" on public.calendar_settings
  for insert with check (auth.uid() = user_id);
drop policy if exists "calendar_settings_update_own" on public.calendar_settings;
create policy "calendar_settings_update_own" on public.calendar_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "calendar_settings_delete_own" on public.calendar_settings;
create policy "calendar_settings_delete_own" on public.calendar_settings
  for delete using (auth.uid() = user_id);
