-- =====================================================================
--  Recettes — migration : les tables du module (étape 1)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--  Conception dans docs/etude-recettes.md §7 et §12.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Une recette. Ses ingrédients et ses étapes vivent dans la recette, en
-- `jsonb` : on les lit toujours avec elle, la recherche se fait dans le
-- navigateur, et une recette s'écrit d'un bloc (jamais à moitié). Chaque
-- ingrédient garde son texte tel qu'il est écrit ; sa lecture se calcule.
-- ---------------------------------------------------------------------
create table if not exists public.recettes_recipes (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  title          text not null
                 constraint recettes_recipes_title_check
                 check (char_length(title) between 1 and 200),
  description    text not null default '' check (char_length(description) <= 2000),
  servings       smallint
                 constraint recettes_recipes_servings_check
                 check (servings between 1 and 100),
  yield_label    text not null default 'personnes' check (char_length(yield_label) <= 40),
  prep_minutes   integer
                 constraint recettes_recipes_prep_check
                 check (prep_minutes between 0 and 10080),
  cook_minutes   integer
                 constraint recettes_recipes_cook_check
                 check (cook_minutes between 0 and 10080),
  rest_minutes   integer
                 constraint recettes_recipes_rest_check
                 check (rest_minutes between 0 and 10080),
  category       text not null default 'plat'
                 constraint recettes_recipes_category_check
                 check (category in ('entree', 'plat', 'dessert', 'aperitif', 'petit-dejeuner', 'accompagnement', 'sauce', 'boisson', 'autre')),
  tags           text[] not null default '{}'
                 constraint recettes_recipes_tags_check
                 check (cardinality(tags) <= 20),
  source_url     text check (source_url ~ '^https?://' and char_length(source_url) <= 1000),
  source_name    text not null default '' check (char_length(source_name) <= 200),
  note           text not null default '' check (char_length(note) <= 4000),
  favorite       boolean not null default false,
  ingredients    jsonb not null default '[]'
                 constraint recettes_recipes_ingredients_check
                 check (jsonb_typeof(ingredients) = 'array' and jsonb_array_length(ingredients) <= 150),
  steps          jsonb not null default '[]'
                 constraint recettes_recipes_steps_check
                 check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 80),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists recettes_recipes_user_idx on public.recettes_recipes (user_id, title);

-- ---------------------------------------------------------------------
-- La photo d'une recette — UNE seule (étude §12 : le plus économique). Les
-- fichiers vivent dans le bucket `recettes`, sous
-- `<id du compte>/<id de la recette>/<id de la photo>.jpg` (et `…-thumb.jpg`).
-- Supprimer une recette emporte la ligne ; l'application supprime ensuite
-- les fichiers — le stockage ne suit pas les `on delete cascade`.
-- ---------------------------------------------------------------------
create table if not exists public.recettes_photos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  recipe_id   uuid not null references public.recettes_recipes (id) on delete cascade,
  path        text not null check (char_length(path) between 1 and 300),
  thumb_path  text not null check (char_length(thumb_path) between 1 and 300),
  width       integer not null check (width > 0),
  height      integer not null check (height > 0),
  bytes       integer not null check (bytes >= 0),
  created_at  timestamptz not null default now(),
  constraint recettes_photos_one_per_recipe unique (recipe_id)
);

create index if not exists recettes_photos_user_idx on public.recettes_photos (user_id);

-- ---------------------------------------------------------------------
-- « Je l'ai faite » : le jour, pour combien, une note sur 5, un mot.
-- ---------------------------------------------------------------------
create table if not exists public.recettes_cooked (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  recipe_id   uuid not null references public.recettes_recipes (id) on delete cascade,
  day         date not null,
  servings    smallint check (servings between 1 and 100),
  rating      smallint
              constraint recettes_cooked_rating_check
              check (rating between 1 and 5),
  comment     text not null default '' check (char_length(comment) <= 1000),
  created_at  timestamptz not null default now()
);

create index if not exists recettes_cooked_user_idx on public.recettes_cooked (user_id, recipe_id, day);

-- ---------------------------------------------------------------------
-- Le menu de la semaine : une case par jour et par repas, une ou plusieurs
-- entrées (un plat puis un dessert). Une entrée est une recette, ou un simple
-- titre (« Restes ») quand il n'y a rien à cuisiner. Supprimer une recette
-- la retire du menu.
-- ---------------------------------------------------------------------
create table if not exists public.recettes_plan (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  day         date not null,
  meal        text not null
              constraint recettes_plan_meal_check
              check (meal in ('midi', 'soir')),
  recipe_id   uuid references public.recettes_recipes (id) on delete cascade,
  title       text not null default ''
              constraint recettes_plan_title_check
              check (char_length(title) <= 120),
  servings    smallint check (servings between 1 and 100),
  position    smallint not null default 0,
  created_at  timestamptz not null default now(),
  constraint recettes_plan_what_check check (recipe_id is not null or char_length(title) >= 1)
);

create index if not exists recettes_plan_user_idx on public.recettes_plan (user_id, day, meal, position);

-- ---------------------------------------------------------------------
-- Les réglages : les ingrédients « toujours là », décochés d'office avant
-- d'envoyer une liste à Courses (étude §12). Une ligne par compte. Les
-- associations aux aliments de Nutrition viendront ici, plus tard.
-- ---------------------------------------------------------------------
create table if not exists public.recettes_settings (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  pantry      text[] not null default '{}' check (cardinality(pantry) <= 200),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Row Level Security : chaque compte ne voit et ne modifie que ses lignes.
-- Motif copié de schema.sql — quatre politiques par table.
-- ---------------------------------------------------------------------
alter table public.recettes_recipes enable row level security;
alter table public.recettes_photos enable row level security;
alter table public.recettes_cooked enable row level security;
alter table public.recettes_plan enable row level security;
alter table public.recettes_settings enable row level security;

drop policy if exists "recettes_recipes_select_own" on public.recettes_recipes;
create policy "recettes_recipes_select_own" on public.recettes_recipes
  for select using (auth.uid() = user_id);
drop policy if exists "recettes_recipes_insert_own" on public.recettes_recipes;
create policy "recettes_recipes_insert_own" on public.recettes_recipes
  for insert with check (auth.uid() = user_id);
drop policy if exists "recettes_recipes_update_own" on public.recettes_recipes;
create policy "recettes_recipes_update_own" on public.recettes_recipes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "recettes_recipes_delete_own" on public.recettes_recipes;
create policy "recettes_recipes_delete_own" on public.recettes_recipes
  for delete using (auth.uid() = user_id);

drop policy if exists "recettes_photos_select_own" on public.recettes_photos;
create policy "recettes_photos_select_own" on public.recettes_photos
  for select using (auth.uid() = user_id);
drop policy if exists "recettes_photos_insert_own" on public.recettes_photos;
create policy "recettes_photos_insert_own" on public.recettes_photos
  for insert with check (auth.uid() = user_id);
drop policy if exists "recettes_photos_update_own" on public.recettes_photos;
create policy "recettes_photos_update_own" on public.recettes_photos
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "recettes_photos_delete_own" on public.recettes_photos;
create policy "recettes_photos_delete_own" on public.recettes_photos
  for delete using (auth.uid() = user_id);

drop policy if exists "recettes_cooked_select_own" on public.recettes_cooked;
create policy "recettes_cooked_select_own" on public.recettes_cooked
  for select using (auth.uid() = user_id);
drop policy if exists "recettes_cooked_insert_own" on public.recettes_cooked;
create policy "recettes_cooked_insert_own" on public.recettes_cooked
  for insert with check (auth.uid() = user_id);
drop policy if exists "recettes_cooked_update_own" on public.recettes_cooked;
create policy "recettes_cooked_update_own" on public.recettes_cooked
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "recettes_cooked_delete_own" on public.recettes_cooked;
create policy "recettes_cooked_delete_own" on public.recettes_cooked
  for delete using (auth.uid() = user_id);

drop policy if exists "recettes_plan_select_own" on public.recettes_plan;
create policy "recettes_plan_select_own" on public.recettes_plan
  for select using (auth.uid() = user_id);
drop policy if exists "recettes_plan_insert_own" on public.recettes_plan;
create policy "recettes_plan_insert_own" on public.recettes_plan
  for insert with check (auth.uid() = user_id);
drop policy if exists "recettes_plan_update_own" on public.recettes_plan;
create policy "recettes_plan_update_own" on public.recettes_plan
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "recettes_plan_delete_own" on public.recettes_plan;
create policy "recettes_plan_delete_own" on public.recettes_plan
  for delete using (auth.uid() = user_id);

drop policy if exists "recettes_settings_select_own" on public.recettes_settings;
create policy "recettes_settings_select_own" on public.recettes_settings
  for select using (auth.uid() = user_id);
drop policy if exists "recettes_settings_insert_own" on public.recettes_settings;
create policy "recettes_settings_insert_own" on public.recettes_settings
  for insert with check (auth.uid() = user_id);
drop policy if exists "recettes_settings_update_own" on public.recettes_settings;
create policy "recettes_settings_update_own" on public.recettes_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "recettes_settings_delete_own" on public.recettes_settings;
create policy "recettes_settings_delete_own" on public.recettes_settings
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Le bucket des photos : PRIVÉ, 5 Mo au plus par fichier, JPEG seulement —
-- le ré-encodage dans le navigateur retire au passage les métadonnées (GPS).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recettes', 'recettes', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Chaque compte ne touche qu'à son dossier : le premier segment du chemin est son identifiant.
drop policy if exists "recettes_objects_select_own" on storage.objects;
create policy "recettes_objects_select_own" on storage.objects
  for select using (bucket_id = 'recettes' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "recettes_objects_insert_own" on storage.objects;
create policy "recettes_objects_insert_own" on storage.objects
  for insert with check (bucket_id = 'recettes' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "recettes_objects_update_own" on storage.objects;
create policy "recettes_objects_update_own" on storage.objects
  for update using (bucket_id = 'recettes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'recettes' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "recettes_objects_delete_own" on storage.objects;
create policy "recettes_objects_delete_own" on storage.objects
  for delete using (bucket_id = 'recettes' and (storage.foldername(name))[1] = auth.uid()::text);
