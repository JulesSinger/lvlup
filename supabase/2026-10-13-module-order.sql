-- =====================================================================
-- Atlas : l'ordre des modules choisi à la main (demande de Jules, 13/10/2026).
--
-- Une liste d'identifiants de modules (`budget`, `taches`…), rangée avec les
-- réglages du compte pour être la même sur chaque appareil. Vide = l'ordre
-- du registre. Un module ajouté plus tard vient à la fin ; un identifiant
-- inconnu est ignoré par l'application — rien à contraindre ici.
-- Rejouable sans casse.
-- =====================================================================

alter table public.profiles
  add column if not exists module_order text[] not null default '{}';
