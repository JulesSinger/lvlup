-- =====================================================================
--  Courses — terminer une course depuis le connecteur de Claude
--  (docs/connecteur-claude.md §8). À coller dans Supabase Studio > SQL
--  Editor > Run. Idempotent.
--
--  `courses_close_trip(plan)` écrit pour `auth.uid()`, le compte de la
--  session de l'app. La fonction `atlas-mcp` n'a pas de session : elle
--  tourne avec la clé de service et sait, par le jeton du connecteur, pour
--  quel compte elle écrit. Cette variante prend donc le compte en paramètre
--  — et **seule la clé de service peut l'appeler** : sans ce `revoke`,
--  n'importe quel compte connecté pourrait écrire chez un autre.
--
--  Même transaction que l'app (la course, ses articles, l'horloge de la
--  récurrence, la liste), plus ce qu'un ticket peut apporter de neuf : un
--  magasin et des articles encore inconnus du catalogue.
-- =====================================================================

create or replace function public.courses_close_trip_for(p_user uuid, plan jsonb)
returns public.courses_trips
language plpgsql
security invoker
set search_path = public
as $$
declare
  t public.courses_trips;
begin
  if p_user is null then
    raise exception 'compte manquant';
  end if;

  if plan ? 'newStore' then
    insert into public.courses_stores (id, user_id, name)
    values ((plan->'newStore'->>'id')::uuid, p_user, plan->'newStore'->>'name');
  end if;

  insert into public.courses_items (id, user_id, name, aisle)
  select (i->>'id')::uuid, p_user, i->>'name', i->>'aisle'
  from jsonb_array_elements(coalesce(plan->'newItems', '[]'::jsonb)) as i;

  insert into public.courses_trips (user_id, number, day, store_id, store_name, total_cents, note)
  values (
    p_user,
    (plan->'trip'->>'number')::integer,
    (plan->'trip'->>'day')::date,
    nullif(plan->'trip'->>'storeId', '')::uuid,
    coalesce(plan->'trip'->>'storeName', ''),
    (plan->'trip'->>'totalCents')::integer,
    coalesce(plan->'trip'->>'note', '')
  )
  returning * into t;

  insert into public.courses_trip_items (user_id, trip_id, item_id, name, aisle, quantity, price_cents)
  select p_user, t.id, nullif(i->>'itemId', '')::uuid, i->>'name', i->>'aisle',
         coalesce(i->>'quantity', ''), (i->>'priceCents')::integer
  from jsonb_array_elements(coalesce(plan->'items', '[]'::jsonb)) as i;

  update public.courses_items
  set last_trip_number = t.number
  where user_id = p_user
    and id in (select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(plan->'purchasedItemIds', '[]'::jsonb)) as x);

  delete from public.courses_list
  where user_id = p_user
    and id in (select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(plan->'removeEntryIds', '[]'::jsonb)) as x);

  insert into public.courses_list (user_id, item_id, quantity)
  select p_user, ci.id, ci.default_quantity
  from public.courses_items ci
  where ci.user_id = p_user
    and ci.id in (select (x #>> '{}')::uuid from jsonb_array_elements(coalesce(plan->'addItemIds', '[]'::jsonb)) as x)
    and not exists (select 1 from public.courses_list l where l.user_id = p_user and l.item_id = ci.id);

  return t;
end;
$$;

revoke all on function public.courses_close_trip_for(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.courses_close_trip_for(uuid, jsonb) to service_role;
