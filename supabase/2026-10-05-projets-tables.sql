-- =====================================================================
--  Projets — migration : tables du module (étape 1)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Cinq tables, préfixées `projets_`, avec RLS — conception dans
--  docs/etude-projets.md §7 et §12. Les paiements, le temps passé, les
--  liens et les images viendront avec leurs étapes, dans des migrations à
--  part.
--
--  Les identifiants sont CHOISIS PAR L'APPLICATION avant le premier envoi
--  (la valeur par défaut ne sert que pour un import) : une file hors ligne
--  pourra s'y brancher plus tard sans migration.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Un client : un commerce. Il peut avoir plusieurs projets.
-- ---------------------------------------------------------------------
create table if not exists public.projets_clients (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null
               constraint projets_clients_name_check
               check (char_length(name) between 1 and 120),
  trade        text not null
               constraint projets_clients_trade_check
               check (trade in ('foodtruck', 'restaurant', 'coiffure', 'fleuriste', 'boulangerie', 'artisan', 'commerce', 'autre')),
  contact_name text not null default '' check (char_length(contact_name) <= 120),
  phone        text not null default '' check (char_length(phone) <= 40),
  email        text not null default '' check (char_length(email) <= 200),
  address      text not null default '' check (char_length(address) <= 300),
  note         text not null default '' check (char_length(note) <= 4000),
  archived     boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists projets_clients_user_idx on public.projets_clients (user_id);

-- ---------------------------------------------------------------------
-- Un projet. Le STATUT ne dit que la relation avec le client ; le travail
-- avance en chantiers (table suivante), dont l'état se calcule.
--
-- `number` est unique par compte : c'est lui, et non l'identifiant, qui
-- fera les références stables vers Budget. Supprimer un client qui a encore
-- des projets est refusé (`restrict`) : on l'archive.
-- ---------------------------------------------------------------------
create table if not exists public.projets_projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  client_id     uuid not null references public.projets_clients (id) on delete restrict,
  number        integer not null check (number > 0),
  title         text not null
                constraint projets_projects_title_check
                check (char_length(title) between 1 and 120),
  template      text not null default '' check (char_length(template) <= 40),
  status        text not null default 'lead'
                constraint projets_projects_status_check
                check (status in ('lead', 'quoted', 'signed', 'production', 'delivered', 'maintenance', 'done', 'lost')),
  waiting_for   text check (char_length(waiting_for) between 1 and 200),
  waiting_since date,
  start_day     date,
  due_day       date,
  price_cents   integer check (price_cents >= 0),
  needs         jsonb not null default '{}'::jsonb check (jsonb_typeof(needs) = 'object'),
  note          text not null default '' check (char_length(note) <= 4000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint projets_projects_number_unique unique (user_id, number),
  constraint projets_projects_waiting_check check (waiting_for is not null or waiting_since is null)
);

create index if not exists projets_projects_user_idx on public.projets_projects (user_id, due_day);

-- ---------------------------------------------------------------------
-- Un chantier d'un projet : Contenus, Développement, Hébergement…
-- Menés en parallèle ; `position` ne sert qu'à l'ordre d'affichage. Aucun
-- état stocké. L'unicité (id, project_id) permet aux tâches de vérifier
-- qu'elles sont dans un chantier de LEUR projet.
-- ---------------------------------------------------------------------
create table if not exists public.projets_workstreams (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projets_projects (id) on delete cascade,
  title      text not null
             constraint projets_workstreams_title_check
             check (char_length(title) between 1 and 80),
  position   integer not null default 0,
  due_day    date,
  constraint projets_workstreams_project_unique unique (id, project_id)
);

create index if not exists projets_workstreams_user_idx on public.projets_workstreams (user_id, project_id, position);

-- ---------------------------------------------------------------------
-- Une tâche, dans un chantier de son projet.
-- ---------------------------------------------------------------------
create table if not exists public.projets_tasks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  project_id     uuid not null references public.projets_projects (id) on delete cascade,
  workstream_id  uuid not null,
  title          text not null
                 constraint projets_tasks_title_check
                 check (char_length(title) between 1 and 500),
  note           text not null default '' check (char_length(note) <= 4000),
  planned_day    date,
  due_day        date,
  waiting_client boolean not null default false,
  position       integer not null default 0,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  constraint projets_tasks_workstream_fk foreign key (workstream_id, project_id)
    references public.projets_workstreams (id, project_id) on delete cascade
);

create index if not exists projets_tasks_user_idx on public.projets_tasks (user_id, project_id);
create index if not exists projets_tasks_workstream_idx on public.projets_tasks (workstream_id, position);

-- ---------------------------------------------------------------------
-- Le journal d'un projet : des notes datées.
-- ---------------------------------------------------------------------
create table if not exists public.projets_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projets_projects (id) on delete cascade,
  day        date not null,
  text       text not null
             constraint projets_notes_text_check
             check (char_length(text) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists projets_notes_user_idx on public.projets_notes (user_id, project_id, day);

-- ---------------------------------------------------------------------
-- Row Level Security : chaque compte ne voit et ne modifie que ses lignes.
-- Motif copié de schema.sql — quatre politiques par table.
-- ---------------------------------------------------------------------
alter table public.projets_clients enable row level security;
alter table public.projets_projects enable row level security;
alter table public.projets_workstreams enable row level security;
alter table public.projets_tasks enable row level security;
alter table public.projets_notes enable row level security;

drop policy if exists "projets_clients_select_own" on public.projets_clients;
create policy "projets_clients_select_own" on public.projets_clients
  for select using (auth.uid() = user_id);
drop policy if exists "projets_clients_insert_own" on public.projets_clients;
create policy "projets_clients_insert_own" on public.projets_clients
  for insert with check (auth.uid() = user_id);
drop policy if exists "projets_clients_update_own" on public.projets_clients;
create policy "projets_clients_update_own" on public.projets_clients
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "projets_clients_delete_own" on public.projets_clients;
create policy "projets_clients_delete_own" on public.projets_clients
  for delete using (auth.uid() = user_id);

drop policy if exists "projets_projects_select_own" on public.projets_projects;
create policy "projets_projects_select_own" on public.projets_projects
  for select using (auth.uid() = user_id);
drop policy if exists "projets_projects_insert_own" on public.projets_projects;
create policy "projets_projects_insert_own" on public.projets_projects
  for insert with check (auth.uid() = user_id);
drop policy if exists "projets_projects_update_own" on public.projets_projects;
create policy "projets_projects_update_own" on public.projets_projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "projets_projects_delete_own" on public.projets_projects;
create policy "projets_projects_delete_own" on public.projets_projects
  for delete using (auth.uid() = user_id);

drop policy if exists "projets_workstreams_select_own" on public.projets_workstreams;
create policy "projets_workstreams_select_own" on public.projets_workstreams
  for select using (auth.uid() = user_id);
drop policy if exists "projets_workstreams_insert_own" on public.projets_workstreams;
create policy "projets_workstreams_insert_own" on public.projets_workstreams
  for insert with check (auth.uid() = user_id);
drop policy if exists "projets_workstreams_update_own" on public.projets_workstreams;
create policy "projets_workstreams_update_own" on public.projets_workstreams
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "projets_workstreams_delete_own" on public.projets_workstreams;
create policy "projets_workstreams_delete_own" on public.projets_workstreams
  for delete using (auth.uid() = user_id);

drop policy if exists "projets_tasks_select_own" on public.projets_tasks;
create policy "projets_tasks_select_own" on public.projets_tasks
  for select using (auth.uid() = user_id);
drop policy if exists "projets_tasks_insert_own" on public.projets_tasks;
create policy "projets_tasks_insert_own" on public.projets_tasks
  for insert with check (auth.uid() = user_id);
drop policy if exists "projets_tasks_update_own" on public.projets_tasks;
create policy "projets_tasks_update_own" on public.projets_tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "projets_tasks_delete_own" on public.projets_tasks;
create policy "projets_tasks_delete_own" on public.projets_tasks
  for delete using (auth.uid() = user_id);

drop policy if exists "projets_notes_select_own" on public.projets_notes;
create policy "projets_notes_select_own" on public.projets_notes
  for select using (auth.uid() = user_id);
drop policy if exists "projets_notes_insert_own" on public.projets_notes;
create policy "projets_notes_insert_own" on public.projets_notes
  for insert with check (auth.uid() = user_id);
drop policy if exists "projets_notes_update_own" on public.projets_notes;
create policy "projets_notes_update_own" on public.projets_notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "projets_notes_delete_own" on public.projets_notes;
create policy "projets_notes_delete_own" on public.projets_notes
  for delete using (auth.uid() = user_id);
