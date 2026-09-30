-- =====================================================================
--  Hauts faits — migration : tables du module (étape 1)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Deux tables, préfixées `hautsfaits_`, avec RLS — conception dans
--  docs/etude-hauts-faits.md §8. Les photos (leur table, le bucket et ses
--  politiques) viendront avec l'étape 4, dans une migration à part.
--
--  L'identifiant d'un haut fait est CHOISI PAR L'APPLICATION avant le
--  premier envoi (la valeur par défaut ne sert que pour un import) : une
--  file hors ligne pourra s'y brancher plus tard sans migration.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Un haut fait : le brevet, un semi, six mois à Madrid.
--
-- La date est rangée au PREMIER JOUR de la période qu'elle décrit, avec sa
-- précision : « 2014 » = 2014-01-01 en 'year', « juin 2018 » = 2018-06-01
-- en 'month'. Le tri marche tel quel ; la base refuse une date qui ne
-- tombe pas au début de sa période, pour qu'un même haut fait ne s'écrive
-- que d'une façon.
--
-- `date_end` fait du haut fait une période ; elle a alors sa précision.
-- ---------------------------------------------------------------------
create table if not exists public.hautsfaits_feats (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  title              text not null
                     constraint hautsfaits_feats_title_check
                     check (char_length(title) between 1 and 200),
  category           text not null
                     constraint hautsfaits_feats_category_check
                     check (category in ('etudes', 'sport', 'voyage', 'chezsoi', 'travail', 'proches', 'creation', 'autre')),
  date_start         date not null,
  date_precision     text not null
                     constraint hautsfaits_feats_precision_check
                     check (date_precision in ('day', 'month', 'year')),
  date_end           date,
  date_end_precision text
                     constraint hautsfaits_feats_end_precision_check
                     check (date_end_precision in ('day', 'month', 'year')),
  major              boolean not null default false,
  highlight          text not null default '' check (char_length(highlight) <= 60),
  place              text not null default '' check (char_length(place) <= 120),
  people             text not null default '' check (char_length(people) <= 200),
  story              text not null default '' check (char_length(story) <= 4000),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint hautsfaits_feats_start_aligned_check check (
    (date_precision <> 'month' or extract(day from date_start) = 1)
    and (date_precision <> 'year' or (extract(month from date_start) = 1 and extract(day from date_start) = 1))
  ),
  constraint hautsfaits_feats_end_check check (
    (date_end is null and date_end_precision is null)
    or (date_end is not null and date_end_precision is not null and date_end >= date_start)
  )
);

create index if not exists hautsfaits_feats_user_idx
  on public.hautsfaits_feats (user_id, date_start);

-- ---------------------------------------------------------------------
-- Les réglages du module, une ligne par compte. En base plutôt que sur
-- l'appareil : la date de naissance appartient au compte.
-- ---------------------------------------------------------------------
create table if not exists public.hautsfaits_settings (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  birth_date           date,
  on_this_day_reminder boolean not null default false,
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Row Level Security : chaque compte ne voit et ne modifie que ses lignes.
-- Motif copié de schema.sql — quatre politiques par table.
-- ---------------------------------------------------------------------
alter table public.hautsfaits_feats enable row level security;
alter table public.hautsfaits_settings enable row level security;

drop policy if exists "hautsfaits_feats_select_own" on public.hautsfaits_feats;
create policy "hautsfaits_feats_select_own" on public.hautsfaits_feats
  for select using (auth.uid() = user_id);
drop policy if exists "hautsfaits_feats_insert_own" on public.hautsfaits_feats;
create policy "hautsfaits_feats_insert_own" on public.hautsfaits_feats
  for insert with check (auth.uid() = user_id);
drop policy if exists "hautsfaits_feats_update_own" on public.hautsfaits_feats;
create policy "hautsfaits_feats_update_own" on public.hautsfaits_feats
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "hautsfaits_feats_delete_own" on public.hautsfaits_feats;
create policy "hautsfaits_feats_delete_own" on public.hautsfaits_feats
  for delete using (auth.uid() = user_id);

drop policy if exists "hautsfaits_settings_select_own" on public.hautsfaits_settings;
create policy "hautsfaits_settings_select_own" on public.hautsfaits_settings
  for select using (auth.uid() = user_id);
drop policy if exists "hautsfaits_settings_insert_own" on public.hautsfaits_settings;
create policy "hautsfaits_settings_insert_own" on public.hautsfaits_settings
  for insert with check (auth.uid() = user_id);
drop policy if exists "hautsfaits_settings_update_own" on public.hautsfaits_settings;
create policy "hautsfaits_settings_update_own" on public.hautsfaits_settings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "hautsfaits_settings_delete_own" on public.hautsfaits_settings;
create policy "hautsfaits_settings_delete_own" on public.hautsfaits_settings
  for delete using (auth.uid() = user_id);
