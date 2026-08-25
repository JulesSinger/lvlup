-- =====================================================================
--  Astra — migration : enveloppes d'épargne (étape 1, docs/etude-astra-epargne.md)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Trois changements :
--   1. Une nouvelle nature de catégorie, `epargne`, distincte de `transfert`
--      (docs/etude-astra-epargne.md §4.1) : une catégorie `epargne` reste
--      exclue du camembert du mois, comme `transfert`, mais alimente en
--      plus le total mis de côté (§3).
--   2. `budget_envelopes` — les enveloppes elles-mêmes, dynamiques.
--   3. `budget_envelope_moves` — le journal des affectations/retraits, dont
--      la somme donne le solde de chaque enveloppe (§4.3 : un solde
--      recalculé, jamais stocké, ne peut pas diverger).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Nature de catégorie `epargne`
--
-- Élargit une contrainte déjà posée : on la retire avant de la reposer,
-- pour que cette migration reste rejouable sans casse.
-- ---------------------------------------------------------------------
alter table public.budget_categories
  drop constraint if exists budget_categories_kind_check;
alter table public.budget_categories
  add constraint budget_categories_kind_check
  check (kind in ('fixe', 'variable', 'revenu', 'transfert', 'epargne'));

-- ---------------------------------------------------------------------
-- 2. Les enveloppes
--
-- Pas d'objectif chiffré dans cette V1 (docs/etude-astra-epargne.md §7 Q2) :
-- seul le solde compte pour l'instant. Un `target_cents` viendra plus tard
-- si l'usage en fait sentir le besoin — colonne additive, sans rien casser.
-- ---------------------------------------------------------------------
create table if not exists public.budget_envelopes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  emoji      text not null default '💶',
  color      text not null default '#7c8cf8',
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists budget_envelopes_user_idx
  on public.budget_envelopes (user_id, position);

-- ---------------------------------------------------------------------
-- 3. Le journal des mouvements
--
-- `amount_cents` signé : `+` affecte des fonds à l'enveloppe, `-` les en
-- retire (docs/etude-astra-epargne.md §4.3). Le non-affecté ne se stocke
-- nulle part : c'est le total épargné (somme des écritures `epargne`)
-- moins la somme de tous ces mouvements — l'invariant « la somme des
-- enveloppes égale le total » tient par construction, jamais par une
-- contrainte à vérifier.
--
-- `on delete cascade` sur `envelope_id` : supprimer une enveloppe supprime
-- ses mouvements, ce qui renvoie mécaniquement ses fonds au non-affecté
-- (§7 Q5) sans mouvement compensatoire à écrire.
-- ---------------------------------------------------------------------
create table if not exists public.budget_envelope_moves (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  envelope_id  uuid not null references public.budget_envelopes (id) on delete cascade,
  amount_cents integer not null,
  day          date not null,
  note         text not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists budget_envelope_moves_user_idx
  on public.budget_envelope_moves (user_id, envelope_id);

-- ---------------------------------------------------------------------
-- Row Level Security : chaque compte ne voit et ne modifie que ses lignes.
-- Motif copié de 2026-08-23-budget-tables.sql — quatre politiques par table.
-- ---------------------------------------------------------------------
alter table public.budget_envelopes      enable row level security;
alter table public.budget_envelope_moves enable row level security;

drop policy if exists "budget_envelopes_select_own" on public.budget_envelopes;
create policy "budget_envelopes_select_own" on public.budget_envelopes
  for select using (auth.uid() = user_id);
drop policy if exists "budget_envelopes_insert_own" on public.budget_envelopes;
create policy "budget_envelopes_insert_own" on public.budget_envelopes
  for insert with check (auth.uid() = user_id);
drop policy if exists "budget_envelopes_update_own" on public.budget_envelopes;
create policy "budget_envelopes_update_own" on public.budget_envelopes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "budget_envelopes_delete_own" on public.budget_envelopes;
create policy "budget_envelopes_delete_own" on public.budget_envelopes
  for delete using (auth.uid() = user_id);

drop policy if exists "budget_envelope_moves_select_own" on public.budget_envelope_moves;
create policy "budget_envelope_moves_select_own" on public.budget_envelope_moves
  for select using (auth.uid() = user_id);
drop policy if exists "budget_envelope_moves_insert_own" on public.budget_envelope_moves;
create policy "budget_envelope_moves_insert_own" on public.budget_envelope_moves
  for insert with check (auth.uid() = user_id);
drop policy if exists "budget_envelope_moves_update_own" on public.budget_envelope_moves;
create policy "budget_envelope_moves_update_own" on public.budget_envelope_moves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "budget_envelope_moves_delete_own" on public.budget_envelope_moves;
create policy "budget_envelope_moves_delete_own" on public.budget_envelope_moves
  for delete using (auth.uid() = user_id);
