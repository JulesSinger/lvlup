-- =====================================================================
--  Tier lists — migration : les tables du module
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--  Conception dans docs/etude-tierlists.md.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Une tier list : un titre, une description.
-- ---------------------------------------------------------------------
create table if not exists public.tierlists_lists (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null
               constraint tierlists_lists_title_check
               check (char_length(title) between 1 and 80),
  description  text not null default ''
               constraint tierlists_lists_description_check
               check (char_length(description) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists tierlists_lists_user_idx on public.tierlists_lists (user_id, updated_at desc);

-- ---------------------------------------------------------------------
-- Les rangées d'une liste (S, A, B… par défaut), renommables, recolorables.
-- La couleur est un nom de la palette de l'app, jamais un code.
-- ---------------------------------------------------------------------
create table if not exists public.tierlists_tiers (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  list_id      uuid not null references public.tierlists_lists (id) on delete cascade,
  label        text not null
               constraint tierlists_tiers_label_check
               check (char_length(label) between 1 and 12),
  color        text not null default 'gray'
               constraint tierlists_tiers_color_check
               check (color in ('red', 'orange', 'coral', 'peach', 'yellow', 'lime', 'green', 'teal', 'sky', 'blue', 'indigo', 'violet', 'lavender', 'pink', 'gray')),
  position     integer not null default 0
);

create index if not exists tierlists_tiers_list_idx on public.tierlists_tiers (list_id, position);

-- ---------------------------------------------------------------------
-- Ce qu'on classe : un texte, une image, ou les deux. Sans rangée
-- (`tier_id` nul), il attend dans la réserve ; une rangée supprimée y
-- renvoie ses éléments. L'image vit dans le bucket `tierlists`, sous
-- `<id du compte>/<id de la liste>/<id de l'élément>.jpg` (et `…-thumb.jpg`) ;
-- l'application efface les fichiers, le stockage ne suit pas les cascades.
-- ---------------------------------------------------------------------
create table if not exists public.tierlists_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  list_id      uuid not null references public.tierlists_lists (id) on delete cascade,
  tier_id      uuid references public.tierlists_tiers (id) on delete set null,
  label        text not null default ''
               constraint tierlists_items_label_check
               check (char_length(label) <= 120),
  image_path   text,
  thumb_path   text,
  width        integer,
  height       integer,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  constraint tierlists_items_content_check
    check (char_length(trim(label)) > 0 or image_path is not null)
);

create index if not exists tierlists_items_list_idx on public.tierlists_items (list_id, tier_id, position);

-- ---------------------------------------------------------------------
-- Row Level Security : chaque compte ne voit et ne modifie que ses lignes.
-- ---------------------------------------------------------------------
alter table public.tierlists_lists enable row level security;
alter table public.tierlists_tiers enable row level security;
alter table public.tierlists_items enable row level security;

drop policy if exists "tierlists_lists_select_own" on public.tierlists_lists;
create policy "tierlists_lists_select_own" on public.tierlists_lists
  for select using (auth.uid() = user_id);
drop policy if exists "tierlists_lists_insert_own" on public.tierlists_lists;
create policy "tierlists_lists_insert_own" on public.tierlists_lists
  for insert with check (auth.uid() = user_id);
drop policy if exists "tierlists_lists_update_own" on public.tierlists_lists;
create policy "tierlists_lists_update_own" on public.tierlists_lists
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "tierlists_lists_delete_own" on public.tierlists_lists;
create policy "tierlists_lists_delete_own" on public.tierlists_lists
  for delete using (auth.uid() = user_id);

drop policy if exists "tierlists_tiers_select_own" on public.tierlists_tiers;
create policy "tierlists_tiers_select_own" on public.tierlists_tiers
  for select using (auth.uid() = user_id);
drop policy if exists "tierlists_tiers_insert_own" on public.tierlists_tiers;
create policy "tierlists_tiers_insert_own" on public.tierlists_tiers
  for insert with check (auth.uid() = user_id);
drop policy if exists "tierlists_tiers_update_own" on public.tierlists_tiers;
create policy "tierlists_tiers_update_own" on public.tierlists_tiers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "tierlists_tiers_delete_own" on public.tierlists_tiers;
create policy "tierlists_tiers_delete_own" on public.tierlists_tiers
  for delete using (auth.uid() = user_id);

drop policy if exists "tierlists_items_select_own" on public.tierlists_items;
create policy "tierlists_items_select_own" on public.tierlists_items
  for select using (auth.uid() = user_id);
drop policy if exists "tierlists_items_insert_own" on public.tierlists_items;
create policy "tierlists_items_insert_own" on public.tierlists_items
  for insert with check (auth.uid() = user_id);
drop policy if exists "tierlists_items_update_own" on public.tierlists_items;
create policy "tierlists_items_update_own" on public.tierlists_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "tierlists_items_delete_own" on public.tierlists_items;
create policy "tierlists_items_delete_own" on public.tierlists_items
  for delete using (auth.uid() = user_id);

-- La double authentification (docs/securite.md §7), comme les autres tables.
drop policy if exists "tierlists_lists_mfa" on public.tierlists_lists;
create policy "tierlists_lists_mfa" on public.tierlists_lists
  as restrictive for all to authenticated
  using (public.atlas_mfa_ok())
  with check (public.atlas_mfa_ok());
drop policy if exists "tierlists_tiers_mfa" on public.tierlists_tiers;
create policy "tierlists_tiers_mfa" on public.tierlists_tiers
  as restrictive for all to authenticated
  using (public.atlas_mfa_ok())
  with check (public.atlas_mfa_ok());
drop policy if exists "tierlists_items_mfa" on public.tierlists_items;
create policy "tierlists_items_mfa" on public.tierlists_items
  as restrictive for all to authenticated
  using (public.atlas_mfa_ok())
  with check (public.atlas_mfa_ok());

-- ---------------------------------------------------------------------
-- Le bucket des images : PRIVÉ, 5 Mo au plus par fichier, JPEG seulement —
-- le ré-encodage dans le navigateur retire au passage les métadonnées.
-- La politique `atlas_objects_mfa` (2026-10-14) couvre déjà tous les buckets.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tierlists', 'tierlists', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Chaque compte ne touche qu'à son dossier : le premier segment du chemin est son identifiant.
drop policy if exists "tierlists_objects_select_own" on storage.objects;
create policy "tierlists_objects_select_own" on storage.objects
  for select using (bucket_id = 'tierlists' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "tierlists_objects_insert_own" on storage.objects;
create policy "tierlists_objects_insert_own" on storage.objects
  for insert with check (bucket_id = 'tierlists' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "tierlists_objects_update_own" on storage.objects;
create policy "tierlists_objects_update_own" on storage.objects
  for update using (bucket_id = 'tierlists' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'tierlists' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "tierlists_objects_delete_own" on storage.objects;
create policy "tierlists_objects_delete_own" on storage.objects
  for delete using (bucket_id = 'tierlists' and (storage.foldername(name))[1] = auth.uid()::text);
