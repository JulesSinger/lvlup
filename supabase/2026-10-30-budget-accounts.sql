-- =====================================================================
--  Budget — migration : les comptes (BoursoBank, la carte Pluxee…)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Demande de Jules (2026-10-30) : ses titres-restaurant arrivent sur une
--  carte Pluxee, qui a son solde et ses transactions, comme une carte
--  bancaire. Chaque écriture peut dire d'où part l'argent. Voir
--  docs/etude-astra.md §17.
--
--  `account_id` nul = le compte principal : rien de ce qui existe n'est
--  réécrit, et une version de l'app d'avant les comptes continue d'écrire.
--  Le solde n'est jamais stocké : le solde connu à un jour, plus les
--  écritures des jours suivants.
-- =====================================================================

create table if not exists public.budget_accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null
                constraint budget_accounts_name_check
                check (char_length(name) between 1 and 40),
  emoji         text not null default '🏦' check (char_length(emoji) <= 16),
  -- Le compte principal : celui des écritures sans compte. Un seul par compte d'Atlas.
  is_default    boolean not null default false,
  -- Le solde connu à un jour (centimes, signé), ou rien : solde pas suivi.
  balance_cents bigint,
  balance_day   date,
  -- Quand le solde a été donné : une écriture du jour même notée après compte.
  balance_set_at timestamptz,
  constraint budget_accounts_balance_check check ((balance_cents is null) = (balance_day is null)),
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists budget_accounts_user_idx on public.budget_accounts (user_id, position);
create unique index if not exists budget_accounts_one_default
  on public.budget_accounts (user_id) where is_default;

-- Supprimer un compte rend ses écritures au compte principal, jamais ne les efface.
alter table public.budget_entries
  add column if not exists account_id uuid references public.budget_accounts (id) on delete set null;
create index if not exists budget_entries_account_idx
  on public.budget_entries (account_id) where account_id is not null;

alter table public.budget_accounts enable row level security;

drop policy if exists "budget_accounts_select_own" on public.budget_accounts;
create policy "budget_accounts_select_own" on public.budget_accounts
  for select using (auth.uid() = user_id);
drop policy if exists "budget_accounts_insert_own" on public.budget_accounts;
create policy "budget_accounts_insert_own" on public.budget_accounts
  for insert with check (auth.uid() = user_id);
drop policy if exists "budget_accounts_update_own" on public.budget_accounts;
create policy "budget_accounts_update_own" on public.budget_accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "budget_accounts_delete_own" on public.budget_accounts;
create policy "budget_accounts_delete_own" on public.budget_accounts
  for delete using (auth.uid() = user_id);

-- La double authentification (docs/securite.md §7), comme les autres tables.
drop policy if exists "budget_accounts_mfa" on public.budget_accounts;
create policy "budget_accounts_mfa" on public.budget_accounts
  as restrictive for all to authenticated
  using (public.atlas_mfa_ok())
  with check (public.atlas_mfa_ok());
