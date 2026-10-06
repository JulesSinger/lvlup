-- =====================================================================
--  Projets — migration : la fiche design et les liens (étape 4)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Conception dans docs/etude-projets.md §3.5 à §3.7 et §16. Le
--  questionnaire de besoins a déjà sa colonne (`needs`, étape 1).
-- =====================================================================

-- ---------------------------------------------------------------------
-- La fiche design d'un projet : couleurs, polices, ambiance, références.
-- En JSON, comme les besoins : sa forme évoluera plus vite que le reste.
-- ---------------------------------------------------------------------
alter table public.projets_projects
  add column if not exists design jsonb not null default '{}'::jsonb;

alter table public.projets_projects drop constraint if exists projets_projects_design_check;
alter table public.projets_projects
  add constraint projets_projects_design_check check (jsonb_typeof(design) = 'object');

-- ---------------------------------------------------------------------
-- Un lien ou un accès d'un projet : maquette, dossier partagé, site,
-- registraire, hébergeur, back-office…
--
-- On garde l'adresse et l'IDENTIFIANT, JAMAIS le mot de passe (§3.7) :
-- il n'y a pas de colonne pour lui, et il n'y en aura pas.
-- ---------------------------------------------------------------------
create table if not exists public.projets_links (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.projets_projects (id) on delete cascade,
  kind       text not null
             constraint projets_links_kind_check
             check (kind in ('maquette', 'dossier', 'preprod', 'site', 'domaine', 'hebergement', 'backoffice', 'compte', 'devis', 'autre')),
  label      text not null
             constraint projets_links_label_check
             check (char_length(label) between 1 and 120),
  url        text not null default ''
             constraint projets_links_url_check
             check (char_length(url) <= 2000),
  login      text not null default '' check (char_length(login) <= 200),
  note       text not null default '' check (char_length(note) <= 1000),
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists projets_links_user_idx on public.projets_links (user_id, project_id, position);

alter table public.projets_links enable row level security;

drop policy if exists "projets_links_select_own" on public.projets_links;
create policy "projets_links_select_own" on public.projets_links
  for select using (auth.uid() = user_id);
drop policy if exists "projets_links_insert_own" on public.projets_links;
create policy "projets_links_insert_own" on public.projets_links
  for insert with check (auth.uid() = user_id);
drop policy if exists "projets_links_update_own" on public.projets_links;
create policy "projets_links_update_own" on public.projets_links
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "projets_links_delete_own" on public.projets_links;
create policy "projets_links_delete_own" on public.projets_links
  for delete using (auth.uid() = user_id);
