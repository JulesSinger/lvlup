-- Gels achetés avec des PP.
--
-- Un journal d'achats, pas un solde : la réserve de gels reste recalculée
-- depuis l'historique, comme le streak lui-même. Un compteur qu'on
-- incrémenterait et décrémenterait pourrait dériver de la réalité sans que
-- rien ne le signale — c'est précisément ce que ce projet évite partout.
--
-- Rejouable sans casse.

create table if not exists public.freeze_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Le jour de l'achat compte : un gel acheté mardi ne protège pas le lundi
  -- d'avant.
  day date not null,
  -- PP dépensés, figés à l'achat — comme les PP d'une réalisation.
  cost integer not null check (cost > 0),
  created_at timestamptz not null default now()
);

create index if not exists freeze_purchases_user_day_idx
  on public.freeze_purchases (user_id, day);

alter table public.freeze_purchases enable row level security;

drop policy if exists freeze_purchases_select_own on public.freeze_purchases;
create policy freeze_purchases_select_own on public.freeze_purchases
  for select using (auth.uid() = user_id);

drop policy if exists freeze_purchases_insert_own on public.freeze_purchases;
create policy freeze_purchases_insert_own on public.freeze_purchases
  for insert with check (auth.uid() = user_id);

drop policy if exists freeze_purchases_update_own on public.freeze_purchases;
create policy freeze_purchases_update_own on public.freeze_purchases
  for update using (auth.uid() = user_id);

drop policy if exists freeze_purchases_delete_own on public.freeze_purchases;
create policy freeze_purchases_delete_own on public.freeze_purchases
  for delete using (auth.uid() = user_id);
