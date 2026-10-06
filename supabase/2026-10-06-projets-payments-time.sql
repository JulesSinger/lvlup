-- =====================================================================
--  Projets — migration : les paiements et le temps passé (étape 5)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Conception dans docs/etude-projets.md §3.8, §3.10 et §17.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Un paiement attendu d'un client : acompte, solde, échéance. Reçu quand
-- `received_day` est posé. `number` est unique par compte : la référence
-- vers Budget (« projets:paiement:<numéro> ») ne change pas à la
-- restauration d'une sauvegarde, contrairement à l'identifiant.
-- ---------------------------------------------------------------------
create table if not exists public.projets_payments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  project_id    uuid not null references public.projets_projects (id) on delete cascade,
  number        integer not null check (number > 0),
  label         text not null
                constraint projets_payments_label_check
                check (char_length(label) between 1 and 80),
  amount_cents  integer not null check (amount_cents > 0),
  expected_day  date,
  received_day  date,
  method        text
                constraint projets_payments_method_check
                check (method in ('virement', 'carte', 'cheque', 'especes', 'autre')),
  invoice_ref   text not null default '' check (char_length(invoice_ref) <= 60),
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  constraint projets_payments_number_unique unique (user_id, number),
  -- Un mode de règlement n'a de sens que pour un paiement reçu.
  constraint projets_payments_method_received_check check (method is null or received_day is not null)
);

create index if not exists projets_payments_user_idx on public.projets_payments (user_id, project_id, position);

-- ---------------------------------------------------------------------
-- Du temps passé sur un projet, noté après coup (pas de chronomètre).
-- Le chantier est facultatif : le supprimer garde l'entrée, sans chantier.
-- ---------------------------------------------------------------------
create table if not exists public.projets_time (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  project_id    uuid not null references public.projets_projects (id) on delete cascade,
  workstream_id uuid references public.projets_workstreams (id) on delete set null,
  day           date not null,
  minutes       integer not null
                constraint projets_time_minutes_check
                check (minutes between 1 and 1440),
  note          text not null default '' check (char_length(note) <= 300),
  created_at    timestamptz not null default now()
);

create index if not exists projets_time_user_idx on public.projets_time (user_id, project_id, day);

-- ---------------------------------------------------------------------
-- Row Level Security — quatre politiques par table.
-- ---------------------------------------------------------------------
alter table public.projets_payments enable row level security;
alter table public.projets_time enable row level security;

drop policy if exists "projets_payments_select_own" on public.projets_payments;
create policy "projets_payments_select_own" on public.projets_payments
  for select using (auth.uid() = user_id);
drop policy if exists "projets_payments_insert_own" on public.projets_payments;
create policy "projets_payments_insert_own" on public.projets_payments
  for insert with check (auth.uid() = user_id);
drop policy if exists "projets_payments_update_own" on public.projets_payments;
create policy "projets_payments_update_own" on public.projets_payments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "projets_payments_delete_own" on public.projets_payments;
create policy "projets_payments_delete_own" on public.projets_payments
  for delete using (auth.uid() = user_id);

drop policy if exists "projets_time_select_own" on public.projets_time;
create policy "projets_time_select_own" on public.projets_time
  for select using (auth.uid() = user_id);
drop policy if exists "projets_time_insert_own" on public.projets_time;
create policy "projets_time_insert_own" on public.projets_time
  for insert with check (auth.uid() = user_id);
drop policy if exists "projets_time_update_own" on public.projets_time;
create policy "projets_time_update_own" on public.projets_time
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "projets_time_delete_own" on public.projets_time;
create policy "projets_time_delete_own" on public.projets_time
  for delete using (auth.uid() = user_id);
