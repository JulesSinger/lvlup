-- =====================================================================
-- Objectifs : une référence sur une coche, pour les coches tenues par un
-- autre module (Sport, 08/10/2026 — docs/etude-sport.md §18).
--
-- Sport coche l'action choisie (« Sortie course ») chaque jour couru, avec
-- les kilomètres du jour, sous la référence « sport:jour:AAAA-MM-JJ ». La
-- référence rend la coche rejouable sans doublon, modifiable (une deuxième
-- sortie le même jour) et retirable (la sortie supprimée). NULL pour une
-- coche faite dans Objectifs (Postgres tient les NULL pour distincts).
--
-- Idempotent : rejouable sans casse.
-- =====================================================================

alter table public.checkins add column if not exists ref text;

alter table public.checkins drop constraint if exists checkins_ref_check;
alter table public.checkins add constraint checkins_ref_check
  check (ref is null or char_length(ref) between 1 and 200);

alter table public.checkins drop constraint if exists checkins_user_ref_key;
alter table public.checkins add constraint checkins_user_ref_key unique (user_id, ref);
