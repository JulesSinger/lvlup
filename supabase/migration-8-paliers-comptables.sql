-- =====================================================================
--  Zénith — migration 8 : paliers comptables, actions quantifiées
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Ce que ça met en place :
--   · la nature d'un palier et sa cible chiffrée ;
--   · l'unité et la valeur habituelle d'une action ;
--   · la valeur relevée sur une réalisation.
--
--  Aucune donnée existante n'est touchée : tout palier déjà créé reste un
--  « jalon », c'est-à-dire exactement ce qu'il est aujourd'hui — une case
--  qu'on coche à la main.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Paliers
--
-- `kind` décide de tout le reste :
--   jalon        — coché à la main (défaut, comportement actuel)
--   cumul        — on additionne, jour après jour, jusqu'à la cible
--   serie        — jours consécutifs
--   performance  — meilleure valeur d'une seule séance
--   mesure       — où en est une grandeur suivie dans le temps
-- ---------------------------------------------------------------------
alter table public.tiers
  add column if not exists kind text not null default 'jalon';

alter table public.tiers
  drop constraint if exists tiers_kind_check;
alter table public.tiers
  add constraint tiers_kind_check
  check (kind in ('jalon', 'cumul', 'serie', 'performance', 'mesure'));

-- La cible chiffrée. Négative pour une mesure en delta (« perdre 5 kg » = -5).
alter table public.tiers
  add column if not exists target numeric;

alter table public.tiers
  add column if not exists unit text not null default '';

-- Sens de progression, pour les performances et les mesures.
alter table public.tiers
  add column if not exists direction text not null default 'hausse';

alter table public.tiers
  drop constraint if exists tiers_direction_check;
alter table public.tiers
  add constraint tiers_direction_check check (direction in ('hausse', 'baisse'));

-- Cible absolue (« atteindre 75 kg ») ou relative au premier relevé
-- (« perdre 5 kg »). Le mode delta évite de demander un poids cible, que
-- beaucoup de gens n'ont pas envie de nommer.
alter table public.tiers
  add column if not exists mode text not null default 'absolu';

alter table public.tiers
  drop constraint if exists tiers_mode_check;
alter table public.tiers
  add constraint tiers_mode_check check (mode in ('absolu', 'delta'));

-- Quelles actions alimentent ce palier. Vide = toutes celles de l'objectif,
-- ce qui est le cas courant et évite toute configuration.
alter table public.tiers
  add column if not exists sources uuid[] not null default '{}';

-- ---------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------
alter table public.actions
  add column if not exists unit text not null default '';

-- La valeur habituelle : c'est elle qui permet de garder le geste unique.
-- Toucher la pastille enregistre cette valeur, sans clavier.
alter table public.actions
  add column if not exists default_value numeric;

-- Un relevé (se peser) n'est pas un effort : il entretient la série mais ne
-- doit pas rapporter les mêmes points qu'une séance, sinon on farme des PP
-- sur une balance.
alter table public.actions
  add column if not exists is_measure boolean not null default false;

-- ---------------------------------------------------------------------
-- Réalisations
-- ---------------------------------------------------------------------
-- La quantité du jour : 8 (km), 30 (min), ou 78.1 (kg) pour un relevé.
alter table public.checkins
  add column if not exists value numeric;

-- Le barème actuel plafonnait à 100 PP ; un relevé peut légitimement en
-- rapporter très peu, jusqu'à 1.
alter table public.checkins
  drop constraint if exists checkins_pp_check;
alter table public.checkins
  add constraint checkins_pp_check check (pp between 0 and 100);

-- ---------------------------------------------------------------------
-- Index : le calcul d'un palier lit les réalisations d'une action donnée.
-- ---------------------------------------------------------------------
create index if not exists checkins_action_day_idx
  on public.checkins (user_id, action_id, day);
