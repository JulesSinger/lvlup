-- Recettes : la semaine type, et les restes — docs/etude-recettes.md §22.
--
-- Demande de Jules (22/11/2026) : « je n'aime pas cuisiner, et encore moins
-- réfléchir à quoi faire ». Une semaine type, jour par jour, midi et soir,
-- qui se recopie dans le menu d'une semaine ; chaque repas dit s'il faut
-- cuisiner ou s'il suffit de sortir des restes (on cuisine pour plusieurs
-- repas, le reste part au frigo ou au congélateur).
--
-- Rejouable : `if not exists`, `drop policy if exists` avant chaque politique.

-- 1. Un repas du menu peut être des restes : rien à cuisiner, rien à acheter.
--    Les lignes existantes restent « à cuisiner » (défaut faux).
alter table public.recettes_plan
  add column if not exists leftovers boolean not null default false;

-- 2. La semaine type : le même motif que `recettes_plan`, un jour de la
--    semaine (1 = lundi … 7 = dimanche, ISO 8601) au lieu d'une date.
create table if not exists public.recettes_template (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  weekday     smallint not null
              constraint recettes_template_weekday_check
              check (weekday between 1 and 7),
  meal        text not null
              constraint recettes_template_meal_check
              check (meal in ('midi', 'soir')),
  recipe_id   uuid references public.recettes_recipes (id) on delete cascade,
  title       text not null default ''
              constraint recettes_template_title_check
              check (char_length(title) <= 120),
  servings    smallint
              constraint recettes_template_servings_check
              check (servings between 1 and 100),
  leftovers   boolean not null default false,
  position    smallint not null default 0,
  created_at  timestamptz not null default now(),
  constraint recettes_template_what_check check (recipe_id is not null or char_length(title) >= 1)
);

create index if not exists recettes_template_user_idx on public.recettes_template (user_id, weekday, meal, position);

alter table public.recettes_template enable row level security;

drop policy if exists "recettes_template_select_own" on public.recettes_template;
create policy "recettes_template_select_own" on public.recettes_template
  for select using (auth.uid() = user_id);
drop policy if exists "recettes_template_insert_own" on public.recettes_template;
create policy "recettes_template_insert_own" on public.recettes_template
  for insert with check (auth.uid() = user_id);
drop policy if exists "recettes_template_update_own" on public.recettes_template;
create policy "recettes_template_update_own" on public.recettes_template
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "recettes_template_delete_own" on public.recettes_template;
create policy "recettes_template_delete_own" on public.recettes_template
  for delete using (auth.uid() = user_id);

-- La double authentification (2026-10-14-mfa-enforce.sql), posée ici pour ne
-- pas dépendre d'un second fichier à rejouer.
drop policy if exists "recettes_template_mfa" on public.recettes_template;
create policy "recettes_template_mfa" on public.recettes_template
  as restrictive for all to authenticated
  using (public.atlas_mfa_ok())
  with check (public.atlas_mfa_ok());
