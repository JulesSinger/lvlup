-- =====================================================================
--  Comète — migration : tables du module courses (étape 1)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Cinq tables, toutes préfixées `courses_`, toutes avec RLS, et une
--  fonction qui clôt une course en une seule transaction — conception
--  complète dans docs/etude-courses.md §5 et §12.
--
--  Montants en CENTIMES ENTIERS, comme Astra : jamais de flottant qu'une
--  addition ferait dériver.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Le catalogue : les articles qu'on achète.
--
-- `recurrence` : nul = ponctuel ; N ≥ 1 = revient toutes les N courses
-- (1 = à chaque course). `last_trip_number` : numéro de la dernière course
-- où l'article a été acheté — la récurrence se calcule à partir de lui.
-- ---------------------------------------------------------------------
create table if not exists public.courses_items (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 80),
  aisle            text not null default 'autre'
                   constraint courses_items_aisle_check
                   check (aisle in ('fruits_legumes', 'boulangerie', 'cremerie', 'boucherie_poissonnerie',
                                    'epicerie_salee', 'epicerie_sucree', 'surgeles', 'boissons',
                                    'hygiene', 'entretien', 'bebe', 'animaux', 'autre')),
  recurrence       integer check (recurrence is null or recurrence between 1 and 52),
  default_quantity text not null default '' check (char_length(default_quantity) <= 30),
  last_trip_number integer check (last_trip_number is null or last_trip_number >= 1),
  created_at       timestamptz not null default now()
);

create index if not exists courses_items_user_idx on public.courses_items (user_id);

-- ---------------------------------------------------------------------
-- Les magasins.
-- ---------------------------------------------------------------------
create table if not exists public.courses_stores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

create index if not exists courses_stores_user_idx on public.courses_stores (user_id);

-- ---------------------------------------------------------------------
-- La liste en cours : ce qu'il faut acheter maintenant. Une ligne désigne
-- un article du catalogue ; supprimer l'article la retire.
-- ---------------------------------------------------------------------
create table if not exists public.courses_list (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  item_id     uuid not null references public.courses_items (id) on delete cascade,
  quantity    text not null default '' check (char_length(quantity) <= 30),
  note        text not null default '' check (char_length(note) <= 200),
  checked     boolean not null default false,
  price_cents integer check (price_cents is null or price_cents between 0 and 10000000),
  created_at  timestamptz not null default now()
);

create index if not exists courses_list_user_idx on public.courses_list (user_id);

-- ---------------------------------------------------------------------
-- Les courses faites. `number` numérote les courses de chaque compte dans
-- l'ordre (1, 2, 3…) — c'est l'horloge de la récurrence. Unique par compte :
-- une même clôture envoyée deux fois (double clic, rejeu) est refusée
-- plutôt que de créer deux courses.
--
-- `store_name` est figé : renommer ou supprimer un magasin ne réécrit pas
-- l'historique (`store_id` passe alors à nul).
-- ---------------------------------------------------------------------
create table if not exists public.courses_trips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  number      integer not null check (number >= 1),
  day         date not null,
  store_id    uuid references public.courses_stores (id) on delete set null,
  store_name  text not null default '' check (char_length(store_name) <= 60),
  total_cents integer not null check (total_cents between 0 and 10000000),
  note        text not null default '' check (char_length(note) <= 200),
  created_at  timestamptz not null default now(),
  constraint courses_trips_number_key unique (user_id, number)
);

create index if not exists courses_trips_user_day_idx on public.courses_trips (user_id, day);

-- ---------------------------------------------------------------------
-- Ce qui a été acheté à chaque course : nom, rayon, quantité et prix
-- FIGÉS, comme les entrées du journal de Cérès. L'historique du prix d'un
-- article par magasin s'en déduit, sans table de plus.
-- ---------------------------------------------------------------------
create table if not exists public.courses_trip_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  trip_id     uuid not null references public.courses_trips (id) on delete cascade,
  item_id     uuid references public.courses_items (id) on delete set null,
  name        text not null check (char_length(name) between 1 and 80),
  aisle       text not null default 'autre'
              constraint courses_trip_items_aisle_check
              check (aisle in ('fruits_legumes', 'boulangerie', 'cremerie', 'boucherie_poissonnerie',
                               'epicerie_salee', 'epicerie_sucree', 'surgeles', 'boissons',
                               'hygiene', 'entretien', 'bebe', 'animaux', 'autre')),
  quantity    text not null default '' check (char_length(quantity) <= 30),
  price_cents integer check (price_cents is null or price_cents between 0 and 10000000)
);

create index if not exists courses_trip_items_user_trip_idx on public.courses_trip_items (user_id, trip_id);
create index if not exists courses_trip_items_item_idx on public.courses_trip_items (user_id, item_id);

-- ---------------------------------------------------------------------
-- Row Level Security : chaque compte ne voit et ne modifie que ses lignes.
-- Motif copié de schema.sql — quatre politiques par table.
-- ---------------------------------------------------------------------
alter table public.courses_items enable row level security;
alter table public.courses_stores enable row level security;
alter table public.courses_list enable row level security;
alter table public.courses_trips enable row level security;
alter table public.courses_trip_items enable row level security;

drop policy if exists "courses_items_select_own" on public.courses_items;
create policy "courses_items_select_own" on public.courses_items
  for select using (auth.uid() = user_id);
drop policy if exists "courses_items_insert_own" on public.courses_items;
create policy "courses_items_insert_own" on public.courses_items
  for insert with check (auth.uid() = user_id);
drop policy if exists "courses_items_update_own" on public.courses_items;
create policy "courses_items_update_own" on public.courses_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "courses_items_delete_own" on public.courses_items;
create policy "courses_items_delete_own" on public.courses_items
  for delete using (auth.uid() = user_id);

drop policy if exists "courses_stores_select_own" on public.courses_stores;
create policy "courses_stores_select_own" on public.courses_stores
  for select using (auth.uid() = user_id);
drop policy if exists "courses_stores_insert_own" on public.courses_stores;
create policy "courses_stores_insert_own" on public.courses_stores
  for insert with check (auth.uid() = user_id);
drop policy if exists "courses_stores_update_own" on public.courses_stores;
create policy "courses_stores_update_own" on public.courses_stores
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "courses_stores_delete_own" on public.courses_stores;
create policy "courses_stores_delete_own" on public.courses_stores
  for delete using (auth.uid() = user_id);

drop policy if exists "courses_list_select_own" on public.courses_list;
create policy "courses_list_select_own" on public.courses_list
  for select using (auth.uid() = user_id);
drop policy if exists "courses_list_insert_own" on public.courses_list;
create policy "courses_list_insert_own" on public.courses_list
  for insert with check (auth.uid() = user_id);
drop policy if exists "courses_list_update_own" on public.courses_list;
create policy "courses_list_update_own" on public.courses_list
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "courses_list_delete_own" on public.courses_list;
create policy "courses_list_delete_own" on public.courses_list
  for delete using (auth.uid() = user_id);

drop policy if exists "courses_trips_select_own" on public.courses_trips;
create policy "courses_trips_select_own" on public.courses_trips
  for select using (auth.uid() = user_id);
drop policy if exists "courses_trips_insert_own" on public.courses_trips;
create policy "courses_trips_insert_own" on public.courses_trips
  for insert with check (auth.uid() = user_id);
drop policy if exists "courses_trips_update_own" on public.courses_trips;
create policy "courses_trips_update_own" on public.courses_trips
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "courses_trips_delete_own" on public.courses_trips;
create policy "courses_trips_delete_own" on public.courses_trips
  for delete using (auth.uid() = user_id);

drop policy if exists "courses_trip_items_select_own" on public.courses_trip_items;
create policy "courses_trip_items_select_own" on public.courses_trip_items
  for select using (auth.uid() = user_id);
drop policy if exists "courses_trip_items_insert_own" on public.courses_trip_items;
create policy "courses_trip_items_insert_own" on public.courses_trip_items
  for insert with check (auth.uid() = user_id);
drop policy if exists "courses_trip_items_update_own" on public.courses_trip_items;
create policy "courses_trip_items_update_own" on public.courses_trip_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "courses_trip_items_delete_own" on public.courses_trip_items;
create policy "courses_trip_items_delete_own" on public.courses_trip_items
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- Clore une course, en UNE transaction.
--
-- Terminer une course écrit à cinq endroits (la course, ses articles, le
-- catalogue, la liste — retirer et remettre). Faites une par une depuis le
-- navigateur, ces écritures pourraient s'arrêter au milieu sur une coupure :
-- une course enregistrée dont la liste n'a pas été vidée, qu'on terminerait
-- une seconde fois. Ici, tout passe ou rien ne passe.
--
-- `security invoker` : la fonction s'exécute avec les droits de l'appelant,
-- donc sous le RLS de chaque table — elle ne peut toucher que ses lignes.
-- Le plan (ce qui est archivé, retiré, remis) est calculé côté application
-- (`lib/trip.ts`) ; la fonction ne fait que l'appliquer, comme les contrats
-- de stockage d'Atlas qui n'embarquent jamais les règles du domaine.
-- ---------------------------------------------------------------------
create or replace function public.courses_close_trip(plan jsonb)
returns public.courses_trips
language plpgsql
security invoker
set search_path = public
as $$
declare
  t public.courses_trips;
begin
  insert into public.courses_trips (user_id, number, day, store_id, store_name, total_cents, note)
  values (
    auth.uid(),
    (plan->'trip'->>'number')::integer,
    (plan->'trip'->>'day')::date,
    nullif(plan->'trip'->>'storeId', '')::uuid,
    coalesce(plan->'trip'->>'storeName', ''),
    (plan->'trip'->>'totalCents')::integer,
    coalesce(plan->'trip'->>'note', '')
  )
  returning * into t;

  insert into public.courses_trip_items (user_id, trip_id, item_id, name, aisle, quantity, price_cents)
  select auth.uid(), t.id, nullif(i->>'itemId', '')::uuid, i->>'name', i->>'aisle',
         coalesce(i->>'quantity', ''), (i->>'priceCents')::integer
  from jsonb_array_elements(coalesce(plan->'items', '[]'::jsonb)) as i;

  update public.courses_items
  set last_trip_number = t.number
  where id in (select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(plan->'purchasedItemIds', '[]'::jsonb)) as x);

  delete from public.courses_list
  where id in (select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(plan->'removeEntryIds', '[]'::jsonb)) as x);

  insert into public.courses_list (user_id, item_id, quantity)
  select auth.uid(), ci.id, ci.default_quantity
  from public.courses_items ci
  where ci.id in (select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(plan->'addItemIds', '[]'::jsonb)) as x)
    -- Un article déjà sur la liste (pas coché cette fois) n'y est pas remis
    -- une seconde fois.
    and not exists (select 1 from public.courses_list l where l.item_id = ci.id);

  return t;
end;
$$;
