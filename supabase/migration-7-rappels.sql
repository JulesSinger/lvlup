-- =====================================================================
--  Zénith — migration 7 : rappels quotidiens par notification push
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Ce que ça met en place :
--   · une table d'abonnements push (un par navigateur/appareil) ;
--   · trois colonnes de réglage sur le profil (activé, heure, fuseau) ;
--   · un garde-fou anti-doublon (last_reminder_day).
--
--  L'envoi lui-même est fait par l'Edge Function `send-reminders`
--  (voir supabase/functions/send-reminders/index.ts) et déclenché par
--  pg_cron — les commandes sont en bas de ce fichier, commentées, parce
--  qu'elles demandent d'y coller ta clé de service.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Abonnements push
--
-- Un abonnement = un navigateur sur un appareil. Le même compte peut donc
-- en avoir plusieurs (iPhone + Mac). `endpoint` est l'identifiant unique
-- fourni par le service de push du navigateur : on s'en sert comme clé,
-- de sorte qu'un ré-abonnement du même appareil écrase l'ancien au lieu
-- d'en créer un deuxième.
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  -- Renseigné à titre indicatif : « iPhone · Safari », pour que l'écran de
  -- réglages sache dire de quel appareil on parle.
  label       text not null default '',
  created_at  timestamptz not null default now(),
  -- Un envoi qui échoue avec 404/410 signifie que l'abonnement est mort :
  -- l'Edge Function le supprime. Les autres échecs sont juste comptés.
  failures    integer not null default 0,
  last_sent_at timestamptz
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_select_own" on public.push_subscriptions;
create policy "push_select_own" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "push_insert_own" on public.push_subscriptions;
create policy "push_insert_own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_update_own" on public.push_subscriptions;
create policy "push_update_own" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_delete_own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Réglages du rappel, sur le profil
--
-- `reminder_time` est une heure LOCALE (celle que tu vois dans l'app) et
-- `tz_offset` le décalage en minutes entre UTC et ton heure locale, mis à
-- jour à chaque ouverture de l'app. Stocker les deux plutôt qu'une heure
-- UTC évite qu'un rappel de 20 h se retrouve à 19 h au changement d'heure.
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists reminder_enabled boolean not null default false;

alter table public.profiles
  add column if not exists reminder_time text not null default '20:00';

alter table public.profiles
  add column if not exists tz_offset integer not null default 0;

-- Dernier jour (local) où un rappel a été envoyé : empêche d'en envoyer
-- deux si le cron passe plusieurs fois dans la fenêtre.
alter table public.profiles
  add column if not exists last_reminder_day date;

-- Un peu de sécurité sur le format « HH:MM ».
alter table public.profiles
  drop constraint if exists profiles_reminder_time_format;
alter table public.profiles
  add constraint profiles_reminder_time_format
  check (reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

-- =====================================================================
--  Déclenchement automatique — à exécuter APRÈS avoir déployé la
--  fonction `send-reminders`.
--
--  1. Active les extensions (une seule fois) :
--
--       create extension if not exists pg_cron with schema extensions;
--       create extension if not exists pg_net with schema extensions;
--
--  2. Planifie l'appel toutes les 5 minutes. Remplace <PROJET> par la
--     référence de ton projet et <SERVICE_ROLE_KEY> par la clé de service
--     (Settings > API > service_role). Cette clé ne doit JAMAIS se
--     retrouver dans le code de l'app — ici elle reste côté base.
--
--       select cron.schedule(
--         'zenith-rappels',
--         '*/5 * * * *',
--         $$
--         select net.http_post(
--           url     := 'https://<PROJET>.supabase.co/functions/v1/send-reminders',
--           headers := jsonb_build_object(
--                        'Content-Type',  'application/json',
--                        'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
--                      ),
--           body    := '{}'::jsonb
--         );
--         $$
--       );
--
--  Pour arrêter : select cron.unschedule('zenith-rappels');
--  Pour voir l'historique : select * from cron.job_run_details
--                           order by start_time desc limit 20;
-- =====================================================================
