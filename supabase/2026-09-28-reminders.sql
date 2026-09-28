-- =====================================================================
--  Atlas — migration : les rappels communs du socle (Polaris, étape 5)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Une table de rappels à venir, commune à tous les modules
--  (docs/etude-taches.md §6, décision du 27/09/2026). Chaque module calcule
--  lui-même ses rappels — il connaît ses règles, le serveur non — et les
--  dépose ici ; la fonction `send-reminders`, déjà appelée toutes les
--  5 minutes par pg_cron pour Zénith, envoie ceux dont l'heure est venue.
--  Le serveur n'a donc besoin de rien savoir des tâches, ni d'aucun autre
--  domaine : il envoie un titre et un texte à une heure donnée.
--
--  Après cette migration, redéployer la fonction :
--    supabase functions deploy send-reminders --no-verify-jwt
-- =====================================================================

create table if not exists public.reminders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- Le nom technique du module qui l'a posé (« taches ») : il ne remplace
  -- jamais que les siens.
  module     text not null check (module ~ '^[a-z]+$'),
  -- Une référence stable choisie par le module (« task:<id>:2026-09-29 »).
  ref        text not null check (char_length(ref) between 1 and 200),
  -- L'instant d'envoi, en UTC : calculé par l'appareil depuis l'heure
  -- locale du jour visé, changement d'heure compris.
  fire_at    timestamptz not null,
  -- 1000 caractères chacun (décision de Jules, 28/09/2026) : un texte plus
  -- long qu'une notification ne peut porter est raccourci par la fonction
  -- d'envoi, jamais refusé ici.
  title      text not null constraint reminders_title_check check (char_length(title) between 1 and 1000),
  body       text not null default '' constraint reminders_body_check check (char_length(body) <= 1000),
  url        text not null default '/' check (char_length(url) <= 200),
  -- Rempli à l'envoi : un rappel envoyé n'est jamais renvoyé.
  sent_at    timestamptz,
  created_at timestamptz not null default now(),
  -- Reposer le même rappel ne le double pas, même une fois envoyé.
  constraint reminders_unique_key unique (user_id, module, ref, fire_at)
);

create index if not exists reminders_user_idx
  on public.reminders (user_id, module);
create index if not exists reminders_due_idx
  on public.reminders (fire_at) where sent_at is null;

alter table public.reminders enable row level security;

drop policy if exists "reminders_select_own" on public.reminders;
create policy "reminders_select_own" on public.reminders
  for select using (auth.uid() = user_id);
drop policy if exists "reminders_insert_own" on public.reminders;
create policy "reminders_insert_own" on public.reminders
  for insert with check (auth.uid() = user_id);
drop policy if exists "reminders_update_own" on public.reminders;
create policy "reminders_update_own" on public.reminders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "reminders_delete_own" on public.reminders;
create policy "reminders_delete_own" on public.reminders
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Les limites portées à 1000 caractères (28/09/2026). Pour une table déjà
-- créée avec les premières limites (200 pour le titre, 500 pour le texte) :
-- les anciennes contraintes, nommées automatiquement par Postgres, sont
-- remplacées. Sans effet sur une table neuve, qui a déjà les bonnes.
-- ---------------------------------------------------------------------
alter table public.reminders drop constraint if exists reminders_title_check;
alter table public.reminders add constraint reminders_title_check
  check (char_length(title) between 1 and 1000);
alter table public.reminders drop constraint if exists reminders_body_check;
alter table public.reminders add constraint reminders_body_check
  check (char_length(body) <= 1000);
