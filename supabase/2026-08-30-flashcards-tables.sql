-- =====================================================================
--  Orbite — migration : tables du module flashcards (étape 1)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Deux tables, toutes préfixées `flashcards_`, toutes avec RLS — conception
--  complète dans docs/etude-flashcards.md. La table `flashcards_reviews`
--  (le journal des révisions, pour les statistiques) arrive à l'étape 6 :
--  rien ci-dessous n'en dépend.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Paquets — le conteneur nommé, même rôle qu'un objectif pour Zénith.
-- ---------------------------------------------------------------------
create table if not exists public.flashcards_decks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  emoji      text not null default '🪐',
  position   integer not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists flashcards_decks_user_idx
  on public.flashcards_decks (user_id, position);

-- ---------------------------------------------------------------------
-- Cartes
--
-- `box` et `due_day` portent l'état Leitner de la carte, stocké directement
-- plutôt que recalculé (docs/etude-flashcards.md §4) : retrouver la boîte
-- courante en rejouant tout l'historique de révision serait coûteux à
-- chaque affichage d'un paquet, alors que le système est fondamentalement
-- à état — la boîte EST l'état de la carte, comme `completedAt` sur un
-- palier de Zénith.
--
-- `box between 1 and 5` : cinq boîtes, décision prise avec Jules le
-- 30/08/2026 (§11 de l'étude). `BOX_COUNT` en TypeScript doit rester égal
-- à cette borne — `lib/schema.test.ts` compare les deux.
-- ---------------------------------------------------------------------
create table if not exists public.flashcards_cards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  deck_id    uuid not null references public.flashcards_decks (id) on delete cascade,
  front      text not null check (char_length(front) between 1 and 2000),
  back       text not null check (char_length(back) between 1 and 2000),
  box        integer not null default 1
             constraint flashcards_cards_box_check
             check (box between 1 and 5),
  due_day    date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists flashcards_cards_user_deck_idx
  on public.flashcards_cards (user_id, deck_id);
create index if not exists flashcards_cards_due_idx
  on public.flashcards_cards (user_id, due_day);

-- ---------------------------------------------------------------------
-- Row Level Security : chaque compte ne voit et ne modifie que ses lignes.
-- Motif copié de schema.sql — quatre politiques par table.
-- ---------------------------------------------------------------------
alter table public.flashcards_decks enable row level security;
alter table public.flashcards_cards enable row level security;

drop policy if exists "flashcards_decks_select_own" on public.flashcards_decks;
create policy "flashcards_decks_select_own" on public.flashcards_decks
  for select using (auth.uid() = user_id);
drop policy if exists "flashcards_decks_insert_own" on public.flashcards_decks;
create policy "flashcards_decks_insert_own" on public.flashcards_decks
  for insert with check (auth.uid() = user_id);
drop policy if exists "flashcards_decks_update_own" on public.flashcards_decks;
create policy "flashcards_decks_update_own" on public.flashcards_decks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "flashcards_decks_delete_own" on public.flashcards_decks;
create policy "flashcards_decks_delete_own" on public.flashcards_decks
  for delete using (auth.uid() = user_id);

drop policy if exists "flashcards_cards_select_own" on public.flashcards_cards;
create policy "flashcards_cards_select_own" on public.flashcards_cards
  for select using (auth.uid() = user_id);
drop policy if exists "flashcards_cards_insert_own" on public.flashcards_cards;
create policy "flashcards_cards_insert_own" on public.flashcards_cards
  for insert with check (auth.uid() = user_id);
drop policy if exists "flashcards_cards_update_own" on public.flashcards_cards;
create policy "flashcards_cards_update_own" on public.flashcards_cards
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "flashcards_cards_delete_own" on public.flashcards_cards;
create policy "flashcards_cards_delete_own" on public.flashcards_cards
  for delete using (auth.uid() = user_id);
