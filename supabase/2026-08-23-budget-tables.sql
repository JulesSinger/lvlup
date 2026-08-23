-- =====================================================================
--  Astra — migration : tables du module budget (étape 1)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Trois tables, toutes préfixées `budget_`, toutes avec RLS — conception
--  complète dans docs/etude-astra.md.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Catégories
--
-- `kind` porte trois décisions (docs/etude-astra.md §2) :
--   fixe      — tombe tous les mois, hors de contrôle direct
--   variable  — sur quoi on peut agir
--   revenu    — salaire, aides, remboursements
--   transfert — un virement vers soi-même, exclu du camembert : sans lui,
--               mettre de l'argent de côté compterait comme une dépense
-- ---------------------------------------------------------------------
create table if not exists public.budget_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  emoji      text not null default '💶',
  color      text not null default '#7c8cf8',
  kind       text not null default 'variable'
             constraint budget_categories_kind_check
             check (kind in ('fixe', 'variable', 'revenu', 'transfert')),
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists budget_categories_user_idx
  on public.budget_categories (user_id, position);

-- ---------------------------------------------------------------------
-- Écritures : lignes du relevé importées, ou saisies à la main
--
-- `amount_cents` est un entier signé, jamais un flottant (docs/etude-astra.md
-- §2) : négatif = sortie, positif = entrée. C'est ce signe, plutôt qu'un
-- champ `type`, qui gère un remboursement — une entrée positive dans une
-- catégorie de dépense.
--
-- `category_id` est nullable à dessein : une opération non catégorisée doit
-- apparaître dans le camembert sous une part « À classer », visible et
-- cliquable, plutôt que de disparaître et fausser le total.
--
-- `import_key` porte l'empreinte de dédoublonnage d'une ligne importée
-- (jour + libellé + montant + rang d'occurrence dans le fichier — voir
-- docs/astra-import-boursobank.md §4) ; nulle pour une saisie manuelle.
-- ---------------------------------------------------------------------
create table if not exists public.budget_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  day          date not null,
  label        text not null,
  amount_cents integer not null,
  category_id  uuid references public.budget_categories (id) on delete set null,
  source       text not null default 'manuelle'
               constraint budget_entries_source_check
               check (source in ('import', 'manuelle')),
  import_key   text,
  note         text not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists budget_entries_user_day_idx
  on public.budget_entries (user_id, day);
create index if not exists budget_entries_category_idx
  on public.budget_entries (category_id);

-- Réimporter le même relevé ne doit jamais dupliquer une ligne. L'index est
-- partiel : les saisies manuelles (import_key nul) restent libres entre
-- elles, Postgres ne les compare pas.
create unique index if not exists budget_entries_import_key_key
  on public.budget_entries (user_id, import_key)
  where import_key is not null;

-- ---------------------------------------------------------------------
-- Règles de catégorisation automatique
--
-- `pattern` est cherché, insensible à la casse, dans le libellé brut d'une
-- écriture. `priority` départage deux règles qui matchent la même ligne :
-- la plus haute gagne. C'est ce qui rend l'import de moins en moins coûteux
-- au fil des mois.
-- ---------------------------------------------------------------------
create table if not exists public.budget_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  pattern     text not null check (char_length(pattern) between 1 and 120),
  category_id uuid not null references public.budget_categories (id) on delete cascade,
  priority    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists budget_rules_user_idx
  on public.budget_rules (user_id, priority desc);

-- ---------------------------------------------------------------------
-- Row Level Security : chaque compte ne voit et ne modifie que ses lignes.
-- Motif copié de schema.sql (goals/tiers) — quatre politiques par table.
-- ---------------------------------------------------------------------
alter table public.budget_categories enable row level security;
alter table public.budget_entries    enable row level security;
alter table public.budget_rules      enable row level security;

drop policy if exists "budget_categories_select_own" on public.budget_categories;
create policy "budget_categories_select_own" on public.budget_categories
  for select using (auth.uid() = user_id);
drop policy if exists "budget_categories_insert_own" on public.budget_categories;
create policy "budget_categories_insert_own" on public.budget_categories
  for insert with check (auth.uid() = user_id);
drop policy if exists "budget_categories_update_own" on public.budget_categories;
create policy "budget_categories_update_own" on public.budget_categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "budget_categories_delete_own" on public.budget_categories;
create policy "budget_categories_delete_own" on public.budget_categories
  for delete using (auth.uid() = user_id);

drop policy if exists "budget_entries_select_own" on public.budget_entries;
create policy "budget_entries_select_own" on public.budget_entries
  for select using (auth.uid() = user_id);
drop policy if exists "budget_entries_insert_own" on public.budget_entries;
create policy "budget_entries_insert_own" on public.budget_entries
  for insert with check (auth.uid() = user_id);
drop policy if exists "budget_entries_update_own" on public.budget_entries;
create policy "budget_entries_update_own" on public.budget_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "budget_entries_delete_own" on public.budget_entries;
create policy "budget_entries_delete_own" on public.budget_entries
  for delete using (auth.uid() = user_id);

drop policy if exists "budget_rules_select_own" on public.budget_rules;
create policy "budget_rules_select_own" on public.budget_rules
  for select using (auth.uid() = user_id);
drop policy if exists "budget_rules_insert_own" on public.budget_rules;
create policy "budget_rules_insert_own" on public.budget_rules
  for insert with check (auth.uid() = user_id);
drop policy if exists "budget_rules_update_own" on public.budget_rules;
create policy "budget_rules_update_own" on public.budget_rules
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "budget_rules_delete_own" on public.budget_rules;
create policy "budget_rules_delete_own" on public.budget_rules
  for delete using (auth.uid() = user_id);
