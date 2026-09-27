-- =====================================================================
--  Polaris — migration : tables du module tâches (étape 1)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Deux tables, préfixées `taches_`, avec RLS — conception complète dans
--  docs/etude-taches.md §7 et §12.
--
--  L'identifiant d'une tâche est CHOISI PAR L'APPLICATION avant le premier
--  envoi (la valeur par défaut ne sert que pour un import) : c'est ce qui
--  permettra de brancher la file hors ligne commune plus tard sans
--  migration, une tâche renvoyée deux fois n'étant écrite qu'une fois.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Une liste : Maison, Travail, Papiers… Un seul niveau, pas de dossiers.
-- ---------------------------------------------------------------------
create table if not exists public.taches_lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  color      text not null default 'bleu'
             constraint taches_lists_color_check
             check (color in ('bleu', 'vert', 'orange', 'rose', 'violet', 'gris')),
  position   integer not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists taches_lists_user_idx
  on public.taches_lists (user_id, position);

-- ---------------------------------------------------------------------
-- Une tâche.
--
-- `list_id` nulle = boîte de réception. Supprimer une liste y renvoie ses
-- tâches (`set null`), jamais à la corbeille — comme « à classer » d'Astra.
-- `parent_id` : une sous-tâche, sur un seul niveau (vérifié par TypeScript) ;
-- supprimer la tâche emporte ses sous-tâches.
--
-- Deux dates (étude §3, décision du 27/09/2026) : `planned_day`, le jour où
-- l'on compte la faire, qui la fait entrer dans « Aujourd'hui » ; et
-- `due_day`, l'échéance facultative. Une heure n'existe qu'avec un jour prévu.
--
-- `recurrence` : nulle = une seule fois ; sinon la règle commune du socle
-- (core/lib/recurrence.ts), qui exige un jour prévu. `repeat_from` dit d'où
-- repart la suivante : de la règle (`schedule`, « tous les lundis ») ou du
-- jour où on l'a faite (`completion`, « 10 jours après »).
-- ---------------------------------------------------------------------
create table if not exists public.taches_tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  list_id      uuid references public.taches_lists (id) on delete set null,
  parent_id    uuid references public.taches_tasks (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  note         text not null default '' check (char_length(note) <= 2000),
  planned_day  date,
  planned_time time,
  due_day      date,
  priority     text not null default 'normale'
               constraint taches_tasks_priority_check
               check (priority in ('normale', 'importante', 'urgente')),
  recurrence   jsonb,
  repeat_from  text not null default 'schedule'
               constraint taches_tasks_repeat_from_check
               check (repeat_from in ('schedule', 'completion')),
  position     integer not null default 0,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  constraint taches_tasks_parent_check check (parent_id is null or parent_id <> id),
  constraint taches_tasks_time_check check (planned_time is null or planned_day is not null),
  constraint taches_tasks_freq_check check (
    recurrence is null
    or (planned_day is not null
        and recurrence->>'freq' = any (array['daily', 'weekly', 'monthly', 'yearly']))
  )
);

create index if not exists taches_tasks_user_idx
  on public.taches_tasks (user_id, planned_day);
create index if not exists taches_tasks_list_idx
  on public.taches_tasks (list_id);
create index if not exists taches_tasks_parent_idx
  on public.taches_tasks (parent_id);

-- ---------------------------------------------------------------------
-- Row Level Security : chaque compte ne voit et ne modifie que ses lignes.
-- Motif copié de schema.sql — quatre politiques par table.
-- ---------------------------------------------------------------------
alter table public.taches_lists enable row level security;
alter table public.taches_tasks enable row level security;

drop policy if exists "taches_lists_select_own" on public.taches_lists;
create policy "taches_lists_select_own" on public.taches_lists
  for select using (auth.uid() = user_id);
drop policy if exists "taches_lists_insert_own" on public.taches_lists;
create policy "taches_lists_insert_own" on public.taches_lists
  for insert with check (auth.uid() = user_id);
drop policy if exists "taches_lists_update_own" on public.taches_lists;
create policy "taches_lists_update_own" on public.taches_lists
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "taches_lists_delete_own" on public.taches_lists;
create policy "taches_lists_delete_own" on public.taches_lists
  for delete using (auth.uid() = user_id);

drop policy if exists "taches_tasks_select_own" on public.taches_tasks;
create policy "taches_tasks_select_own" on public.taches_tasks
  for select using (auth.uid() = user_id);
drop policy if exists "taches_tasks_insert_own" on public.taches_tasks;
create policy "taches_tasks_insert_own" on public.taches_tasks
  for insert with check (auth.uid() = user_id);
drop policy if exists "taches_tasks_update_own" on public.taches_tasks;
create policy "taches_tasks_update_own" on public.taches_tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "taches_tasks_delete_own" on public.taches_tasks;
create policy "taches_tasks_delete_own" on public.taches_tasks
  for delete using (auth.uid() = user_id);
