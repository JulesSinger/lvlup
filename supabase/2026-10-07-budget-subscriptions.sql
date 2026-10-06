-- =====================================================================
--  Budget — migration : les abonnements déclarés à la main
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Demande de Jules (2026-10-07) : pouvoir créer un abonnement soi-même —
--  ce que la détection ne voit pas encore (tout neuf, annuel) ou ne verra
--  jamais (une autre carte, PayPal, des espèces) — et écarter une dépense
--  repérée qui n'en est pas un. Une prévision, jamais une écriture : les
--  relevés restent la vérité du budget. Voir docs/etude-astra.md §14.
-- =====================================================================

create table if not exists public.budget_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null
               constraint budget_subscriptions_name_check
               check (char_length(name) between 1 and 80),
  amount_cents integer not null check (amount_cents > 0),
  frequency    text not null
               constraint budget_subscriptions_frequency_check
               check (frequency in ('hebdomadaire', 'mensuel', 'trimestriel', 'annuel')),
  next_day     date not null,
  -- Une catégorie supprimée laisse l'abonnement sans catégorie, jamais supprimé.
  category_id  uuid references public.budget_categories (id) on delete set null,
  pattern      text not null default '' check (char_length(pattern) <= 200),
  remind_days  integer
               constraint budget_subscriptions_remind_check
               check (remind_days in (3, 7, 15, 30)),
  created_at   timestamptz not null default now()
);

create index if not exists budget_subscriptions_user_idx on public.budget_subscriptions (user_id, next_day);

-- Les dépenses récurrentes repérées qu'on a écartées : leur clé ne revient plus.
create table if not exists public.budget_recurring_ignored (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  key        text not null check (char_length(key) between 1 and 200),
  label      text not null default '' check (char_length(label) <= 200),
  created_at timestamptz not null default now(),
  constraint budget_recurring_ignored_unique unique (user_id, key)
);

create index if not exists budget_recurring_ignored_user_idx on public.budget_recurring_ignored (user_id);

alter table public.budget_subscriptions enable row level security;
alter table public.budget_recurring_ignored enable row level security;

drop policy if exists "budget_subscriptions_select_own" on public.budget_subscriptions;
create policy "budget_subscriptions_select_own" on public.budget_subscriptions
  for select using (auth.uid() = user_id);
drop policy if exists "budget_subscriptions_insert_own" on public.budget_subscriptions;
create policy "budget_subscriptions_insert_own" on public.budget_subscriptions
  for insert with check (auth.uid() = user_id);
drop policy if exists "budget_subscriptions_update_own" on public.budget_subscriptions;
create policy "budget_subscriptions_update_own" on public.budget_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "budget_subscriptions_delete_own" on public.budget_subscriptions;
create policy "budget_subscriptions_delete_own" on public.budget_subscriptions
  for delete using (auth.uid() = user_id);

drop policy if exists "budget_recurring_ignored_select_own" on public.budget_recurring_ignored;
create policy "budget_recurring_ignored_select_own" on public.budget_recurring_ignored
  for select using (auth.uid() = user_id);
drop policy if exists "budget_recurring_ignored_insert_own" on public.budget_recurring_ignored;
create policy "budget_recurring_ignored_insert_own" on public.budget_recurring_ignored
  for insert with check (auth.uid() = user_id);
drop policy if exists "budget_recurring_ignored_update_own" on public.budget_recurring_ignored;
create policy "budget_recurring_ignored_update_own" on public.budget_recurring_ignored
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "budget_recurring_ignored_delete_own" on public.budget_recurring_ignored;
create policy "budget_recurring_ignored_delete_own" on public.budget_recurring_ignored
  for delete using (auth.uid() = user_id);
