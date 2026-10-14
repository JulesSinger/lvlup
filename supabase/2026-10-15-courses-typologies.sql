-- La typologie des achats — docs/etude-courses-typologies.md.
--
-- Un article du catalogue peut recevoir une typologie (Alimentation, Hygiène et
-- beauté…) et, pour l'alimentation, un sous-type (essentiel, plaisir, alcool).
-- Ses courses passées la suivent (décision de Jules, 14/10/2026) : une ligne
-- de course n'en porte une à elle que si on l'a réglée elle-même (une ligne
-- sans article du catalogue). Rien de rempli d'office : sans valeur, l'app la
-- devine d'après le nom et le rayon.
--
-- Rejouable.

alter table public.courses_items add column if not exists typology text;
alter table public.courses_items add column if not exists food_kind text;
alter table public.courses_trip_items add column if not exists typology text;
alter table public.courses_trip_items add column if not exists food_kind text;

alter table public.courses_items drop constraint if exists courses_items_typology_check;
alter table public.courses_items add constraint courses_items_typology_check
  check (typology is null or typology in ('alimentation', 'hygiene', 'entretien', 'maison', 'bebe', 'animaux', 'autre'));
alter table public.courses_items drop constraint if exists courses_items_food_kind_check;
alter table public.courses_items add constraint courses_items_food_kind_check
  check (food_kind is null or (typology = 'alimentation' and food_kind in ('essentiel', 'plaisir', 'alcool')));

alter table public.courses_trip_items drop constraint if exists courses_trip_items_typology_check;
alter table public.courses_trip_items add constraint courses_trip_items_typology_check
  check (typology is null or typology in ('alimentation', 'hygiene', 'entretien', 'maison', 'bebe', 'animaux', 'autre'));
alter table public.courses_trip_items drop constraint if exists courses_trip_items_food_kind_check;
alter table public.courses_trip_items add constraint courses_trip_items_food_kind_check
  check (food_kind is null or (typology = 'alimentation' and food_kind in ('essentiel', 'plaisir', 'alcool')));
