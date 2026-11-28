-- Courses : les modèles de liste — docs/etude-courses.md §20.
--
-- Demande de Jules (28/11/2026) : « choisir mon template prérempli de liste de
-- courses, et en rajouter ponctuellement ». Un modèle est une liste toute
-- faite d'articles du catalogue, avec leur quantité ; on l'applique pour
-- remplir la liste en cours d'un geste.
--
-- Rejouable : `if not exists`, `drop policy if exists` avant chaque politique.

create table if not exists public.courses_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null
              constraint courses_templates_name_check
              check (char_length(name) between 1 and 80),
  emoji       text not null default '📋'
              constraint courses_templates_emoji_check
              check (char_length(emoji) <= 16),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists courses_templates_user_idx on public.courses_templates (user_id, position);

-- Une ligne d'un modèle : un article du catalogue. Supprimer l'article ou le
-- modèle emporte la ligne, comme pour la liste en cours.
create table if not exists public.courses_template_lines (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  template_id  uuid not null references public.courses_templates (id) on delete cascade,
  item_id      uuid not null references public.courses_items (id) on delete cascade,
  quantity     text not null default ''
               constraint courses_template_lines_quantity_check
               check (char_length(quantity) <= 30),
  note         text not null default ''
               constraint courses_template_lines_note_check
               check (char_length(note) <= 200),
  position     integer not null default 0
);

create index if not exists courses_template_lines_user_idx on public.courses_template_lines (user_id, template_id, position);

alter table public.courses_templates enable row level security;
alter table public.courses_template_lines enable row level security;

drop policy if exists "courses_templates_select_own" on public.courses_templates;
create policy "courses_templates_select_own" on public.courses_templates
  for select using (auth.uid() = user_id);
drop policy if exists "courses_templates_insert_own" on public.courses_templates;
create policy "courses_templates_insert_own" on public.courses_templates
  for insert with check (auth.uid() = user_id);
drop policy if exists "courses_templates_update_own" on public.courses_templates;
create policy "courses_templates_update_own" on public.courses_templates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "courses_templates_delete_own" on public.courses_templates;
create policy "courses_templates_delete_own" on public.courses_templates
  for delete using (auth.uid() = user_id);

drop policy if exists "courses_template_lines_select_own" on public.courses_template_lines;
create policy "courses_template_lines_select_own" on public.courses_template_lines
  for select using (auth.uid() = user_id);
drop policy if exists "courses_template_lines_insert_own" on public.courses_template_lines;
create policy "courses_template_lines_insert_own" on public.courses_template_lines
  for insert with check (auth.uid() = user_id);
drop policy if exists "courses_template_lines_update_own" on public.courses_template_lines;
create policy "courses_template_lines_update_own" on public.courses_template_lines
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "courses_template_lines_delete_own" on public.courses_template_lines;
create policy "courses_template_lines_delete_own" on public.courses_template_lines
  for delete using (auth.uid() = user_id);

-- La double authentification (2026-10-14-mfa-enforce.sql), posée ici pour ne
-- pas dépendre d'un second fichier à rejouer.
drop policy if exists "courses_templates_mfa" on public.courses_templates;
create policy "courses_templates_mfa" on public.courses_templates
  as restrictive for all to authenticated
  using (public.atlas_mfa_ok())
  with check (public.atlas_mfa_ok());
drop policy if exists "courses_template_lines_mfa" on public.courses_template_lines;
create policy "courses_template_lines_mfa" on public.courses_template_lines
  as restrictive for all to authenticated
  using (public.atlas_mfa_ok())
  with check (public.atlas_mfa_ok());
