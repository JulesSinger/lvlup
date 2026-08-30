-- =====================================================================
--  Orbite — migration : journal des révisions (étape 6)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Une table, `flashcards_reviews` — le journal, distinct de l'état courant
--  d'une carte (`box`/`due_day` sur flashcards_cards, posée le 30/08/2026).
--  Elle ne pilote rien : elle nourrit les statistiques, comme les
--  check-ins de Zénith nourrissent son historique. Conception complète :
--  docs/etude-flashcards.md §9.
-- =====================================================================

create table if not exists public.flashcards_reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  card_id    uuid not null references public.flashcards_cards (id) on delete cascade,
  day        date not null default current_date,
  correct    boolean not null,
  box_after  integer not null
             constraint flashcards_reviews_box_after_check
             check (box_after between 1 and 5),
  created_at timestamptz not null default now()
);

create index if not exists flashcards_reviews_user_day_idx
  on public.flashcards_reviews (user_id, day);
create index if not exists flashcards_reviews_card_idx
  on public.flashcards_reviews (card_id);

alter table public.flashcards_reviews enable row level security;

drop policy if exists "flashcards_reviews_select_own" on public.flashcards_reviews;
create policy "flashcards_reviews_select_own" on public.flashcards_reviews
  for select using (auth.uid() = user_id);
drop policy if exists "flashcards_reviews_insert_own" on public.flashcards_reviews;
create policy "flashcards_reviews_insert_own" on public.flashcards_reviews
  for insert with check (auth.uid() = user_id);
drop policy if exists "flashcards_reviews_update_own" on public.flashcards_reviews;
create policy "flashcards_reviews_update_own" on public.flashcards_reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "flashcards_reviews_delete_own" on public.flashcards_reviews;
create policy "flashcards_reviews_delete_own" on public.flashcards_reviews
  for delete using (auth.uid() = user_id);
