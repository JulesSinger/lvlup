-- =====================================================================
--  Cérès — migration : tables du module nutrition (étape 1)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Trois tables, toutes préfixées `nutrition_`, toutes avec RLS —
--  conception complète dans docs/etude-nutrition.md §6 et §12.
--
--  Les aliments génériques (table CIQUAL de l'ANSES) n'ont PAS de table :
--  ils sont embarqués dans l'application (étape 2), et une entrée du journal
--  les désigne par leur code CIQUAL.
--
--  Unités : entiers partout, comme Astra stocke des centimes — jamais de
--  flottant qu'une addition ferait dériver. Les kcal sont entières, les
--  macronutriments en DÉCIGRAMMES (dixièmes de gramme : 125 = 12,5 g).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Aliments personnels, et produits Open Food Facts recopiés au scan.
-- Valeurs pour 100 g.
-- ---------------------------------------------------------------------
create table if not exists public.nutrition_foods (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  source        text not null default 'custom'
                constraint nutrition_foods_source_check
                check (source in ('custom', 'off')),
  barcode       text check (barcode is null or char_length(barcode) between 1 and 32),
  name          text not null check (char_length(name) between 1 and 120),
  brand         text check (brand is null or char_length(brand) <= 80),
  kcal          integer not null check (kcal between 0 and 1000),
  protein_dg    integer not null check (protein_dg between 0 and 1000),
  carbs_dg      integer not null check (carbs_dg between 0 and 1000),
  fat_dg        integer not null check (fat_dg between 0 and 1000),
  fiber_dg      integer check (fiber_dg is null or fiber_dg between 0 and 1000),
  serving_grams integer check (serving_grams is null or serving_grams > 0),
  favorite      boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists nutrition_foods_user_idx
  on public.nutrition_foods (user_id);

-- Un même code-barres n'est recopié qu'une fois par compte : le rescanner
-- retrouve la copie (éventuellement corrigée) au lieu d'en créer une autre.
create unique index if not exists nutrition_foods_barcode_key
  on public.nutrition_foods (user_id, barcode)
  where barcode is not null;

-- ---------------------------------------------------------------------
-- Journal : une ligne par aliment mangé.
--
-- `label`, `kcal` et les macros sont FIGÉS à la saisie, comme les PP d'un
-- check-in de Zénith : corriger un aliment ou changer de version de CIQUAL
-- ne réécrit jamais ce qui a été mangé. C'est aussi ce qui permet
-- `on delete set null` sur `food_id` — supprimer un aliment perso ne fait
-- disparaître aucune ligne du journal.
--
-- Au plus une des deux références (aliment perso OU code CIQUAL) ; les deux
-- peuvent être nulles une fois l'aliment perso supprimé.
-- ---------------------------------------------------------------------
create table if not exists public.nutrition_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  day         date not null,
  meal        text not null
              constraint nutrition_entries_meal_check
              check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id     uuid references public.nutrition_foods (id) on delete set null,
  ciqual_code text check (ciqual_code is null or char_length(ciqual_code) between 1 and 16),
  label       text not null check (char_length(label) between 1 and 160),
  grams       integer not null check (grams between 1 and 10000),
  kcal        integer not null check (kcal >= 0),
  protein_dg  integer not null check (protein_dg >= 0),
  carbs_dg    integer not null check (carbs_dg >= 0),
  fat_dg      integer not null check (fat_dg >= 0),
  created_at  timestamptz not null default now(),
  constraint nutrition_entries_single_ref_check
    check (food_id is null or ciqual_code is null)
);

create index if not exists nutrition_entries_user_day_idx
  on public.nutrition_entries (user_id, day);

-- ---------------------------------------------------------------------
-- Objectifs quotidiens, datés.
--
-- En GRAMMES (décision du 25/09/2026, étude §12) : les kcal s'en déduisent
-- (4/4/9) et ne sont pas stockées, pour ne jamais pouvoir contredire les
-- macros. L'objectif d'un jour est la ligne la plus récente dont
-- `effective_from` précède ou égale ce jour — changer d'objectif ne
-- rejuge pas les jours passés.
-- ---------------------------------------------------------------------
create table if not exists public.nutrition_targets (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  effective_from date not null,
  protein_g      integer not null check (protein_g between 0 and 1000),
  carbs_g        integer not null check (carbs_g between 0 and 2000),
  fat_g          integer not null check (fat_g between 0 and 1000),
  created_at     timestamptz not null default now(),
  constraint nutrition_targets_day_key unique (user_id, effective_from)
);

create index if not exists nutrition_targets_user_idx
  on public.nutrition_targets (user_id, effective_from);

-- ---------------------------------------------------------------------
-- Row Level Security : chaque compte ne voit et ne modifie que ses lignes.
-- Motif copié de schema.sql — quatre politiques par table.
-- ---------------------------------------------------------------------
alter table public.nutrition_foods enable row level security;
alter table public.nutrition_entries enable row level security;
alter table public.nutrition_targets enable row level security;

drop policy if exists "nutrition_foods_select_own" on public.nutrition_foods;
create policy "nutrition_foods_select_own" on public.nutrition_foods
  for select using (auth.uid() = user_id);
drop policy if exists "nutrition_foods_insert_own" on public.nutrition_foods;
create policy "nutrition_foods_insert_own" on public.nutrition_foods
  for insert with check (auth.uid() = user_id);
drop policy if exists "nutrition_foods_update_own" on public.nutrition_foods;
create policy "nutrition_foods_update_own" on public.nutrition_foods
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "nutrition_foods_delete_own" on public.nutrition_foods;
create policy "nutrition_foods_delete_own" on public.nutrition_foods
  for delete using (auth.uid() = user_id);

drop policy if exists "nutrition_entries_select_own" on public.nutrition_entries;
create policy "nutrition_entries_select_own" on public.nutrition_entries
  for select using (auth.uid() = user_id);
drop policy if exists "nutrition_entries_insert_own" on public.nutrition_entries;
create policy "nutrition_entries_insert_own" on public.nutrition_entries
  for insert with check (auth.uid() = user_id);
drop policy if exists "nutrition_entries_update_own" on public.nutrition_entries;
create policy "nutrition_entries_update_own" on public.nutrition_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "nutrition_entries_delete_own" on public.nutrition_entries;
create policy "nutrition_entries_delete_own" on public.nutrition_entries
  for delete using (auth.uid() = user_id);

drop policy if exists "nutrition_targets_select_own" on public.nutrition_targets;
create policy "nutrition_targets_select_own" on public.nutrition_targets
  for select using (auth.uid() = user_id);
drop policy if exists "nutrition_targets_insert_own" on public.nutrition_targets;
create policy "nutrition_targets_insert_own" on public.nutrition_targets
  for insert with check (auth.uid() = user_id);
drop policy if exists "nutrition_targets_update_own" on public.nutrition_targets;
create policy "nutrition_targets_update_own" on public.nutrition_targets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "nutrition_targets_delete_own" on public.nutrition_targets;
create policy "nutrition_targets_delete_own" on public.nutrition_targets
  for delete using (auth.uid() = user_id);
