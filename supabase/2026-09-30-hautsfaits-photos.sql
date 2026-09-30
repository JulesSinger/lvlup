-- =====================================================================
--  Hauts faits — migration : les photos (étape 4)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  PREMIER STOCKAGE DE FICHIERS D'ATLAS (docs/etude-hauts-faits.md §5) :
--  une table qui décrit chaque photo, et un bucket privé qui garde les
--  images. L'application réduit chaque photo AVANT l'envoi (une grande
--  version de 2 048 px et une miniature) : quelques centaines de Ko par
--  photo, pour tenir dans le Go gratuit du projet.
--
--  La couverture d'un haut fait est sa photo en première position : pas de
--  colonne à tenir à jour de plus.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Une photo d'un haut fait. Les fichiers vivent dans le bucket
-- `hautsfaits`, sous `<id du compte>/<id du haut fait>/<id de la photo>.jpg`
-- (et `…-thumb.jpg` pour la miniature). Supprimer un haut fait emporte ses
-- lignes ; l'application supprime ensuite les fichiers — le stockage ne
-- suit pas les `on delete cascade`.
-- ---------------------------------------------------------------------
create table if not exists public.hautsfaits_photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  feat_id     uuid not null references public.hautsfaits_feats (id) on delete cascade,
  path        text not null check (char_length(path) between 1 and 300),
  thumb_path  text not null check (char_length(thumb_path) between 1 and 300),
  width       integer not null check (width > 0),
  height      integer not null check (height > 0),
  bytes       integer not null check (bytes >= 0),
  taken_at    timestamp,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists hautsfaits_photos_user_idx
  on public.hautsfaits_photos (user_id);
create index if not exists hautsfaits_photos_feat_idx
  on public.hautsfaits_photos (feat_id, position);

alter table public.hautsfaits_photos enable row level security;

drop policy if exists "hautsfaits_photos_select_own" on public.hautsfaits_photos;
create policy "hautsfaits_photos_select_own" on public.hautsfaits_photos
  for select using (auth.uid() = user_id);
drop policy if exists "hautsfaits_photos_insert_own" on public.hautsfaits_photos;
create policy "hautsfaits_photos_insert_own" on public.hautsfaits_photos
  for insert with check (auth.uid() = user_id);
drop policy if exists "hautsfaits_photos_update_own" on public.hautsfaits_photos;
create policy "hautsfaits_photos_update_own" on public.hautsfaits_photos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "hautsfaits_photos_delete_own" on public.hautsfaits_photos;
create policy "hautsfaits_photos_delete_own" on public.hautsfaits_photos
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Le bucket : PRIVÉ (on lit une photo en étant connecté, jamais par un lien
-- public), 5 Mo au plus par fichier, JPEG seulement — l'application
-- ré-encode tout en JPEG, ce qui retire au passage la position GPS.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hautsfaits', 'hautsfaits', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Chaque compte ne touche qu'à son dossier : le premier segment du chemin
-- est son identifiant. Même principe que le RLS des tables.
drop policy if exists "hautsfaits_objects_select_own" on storage.objects;
create policy "hautsfaits_objects_select_own" on storage.objects
  for select using (bucket_id = 'hautsfaits' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "hautsfaits_objects_insert_own" on storage.objects;
create policy "hautsfaits_objects_insert_own" on storage.objects
  for insert with check (bucket_id = 'hautsfaits' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "hautsfaits_objects_update_own" on storage.objects;
create policy "hautsfaits_objects_update_own" on storage.objects
  for update using (bucket_id = 'hautsfaits' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'hautsfaits' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "hautsfaits_objects_delete_own" on storage.objects;
create policy "hautsfaits_objects_delete_own" on storage.objects
  for delete using (bucket_id = 'hautsfaits' and (storage.foldername(name))[1] = auth.uid()::text);
