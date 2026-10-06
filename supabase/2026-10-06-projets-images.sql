-- =====================================================================
--  Projets — migration : les images (étape 7)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Même motif que les photos de Hauts faits (2026-09-30-hautsfaits-photos.sql) :
--  une table qui décrit chaque image, un bucket PRIVÉ qui garde les fichiers.
--  L'application réduit chaque image avant l'envoi (2 048 px et une
--  miniature), en JPEG : le Go gratuit du projet est partagé avec Hauts faits.
--  Conception dans docs/etude-projets.md §3.6 et §19.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Une image d'un projet : le logo, une photo du commerce, une capture de la
-- maquette. Les fichiers vivent dans le bucket `projets`, sous
-- `<id du compte>/<id du projet>/<id de l'image>.jpg` (et `…-thumb.jpg`).
-- Supprimer un projet emporte ses lignes ; l'application supprime ensuite
-- les fichiers — le stockage ne suit pas les `on delete cascade`.
-- ---------------------------------------------------------------------
create table if not exists public.projets_images (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_id  uuid not null references public.projets_projects (id) on delete cascade,
  kind        text not null
              constraint projets_images_kind_check
              check (kind in ('logo', 'photo', 'maquette')),
  path        text not null check (char_length(path) between 1 and 300),
  thumb_path  text not null check (char_length(thumb_path) between 1 and 300),
  width       integer not null check (width > 0),
  height      integer not null check (height > 0),
  bytes       integer not null check (bytes >= 0),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists projets_images_user_idx on public.projets_images (user_id, project_id, position);

alter table public.projets_images enable row level security;

drop policy if exists "projets_images_select_own" on public.projets_images;
create policy "projets_images_select_own" on public.projets_images
  for select using (auth.uid() = user_id);
drop policy if exists "projets_images_insert_own" on public.projets_images;
create policy "projets_images_insert_own" on public.projets_images
  for insert with check (auth.uid() = user_id);
drop policy if exists "projets_images_update_own" on public.projets_images;
create policy "projets_images_update_own" on public.projets_images
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "projets_images_delete_own" on public.projets_images;
create policy "projets_images_delete_own" on public.projets_images
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Le bucket : PRIVÉ, 5 Mo au plus par fichier, JPEG seulement — le
-- ré-encodage dans le navigateur retire au passage les métadonnées (GPS).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('projets', 'projets', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Chaque compte ne touche qu'à son dossier : le premier segment du chemin est son identifiant.
drop policy if exists "projets_objects_select_own" on storage.objects;
create policy "projets_objects_select_own" on storage.objects
  for select using (bucket_id = 'projets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "projets_objects_insert_own" on storage.objects;
create policy "projets_objects_insert_own" on storage.objects
  for insert with check (bucket_id = 'projets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "projets_objects_update_own" on storage.objects;
create policy "projets_objects_update_own" on storage.objects
  for update using (bucket_id = 'projets' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'projets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "projets_objects_delete_own" on storage.objects;
create policy "projets_objects_delete_own" on storage.objects
  for delete using (bucket_id = 'projets' and (storage.foldername(name))[1] = auth.uid()::text);
