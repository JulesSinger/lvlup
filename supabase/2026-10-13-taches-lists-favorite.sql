-- =====================================================================
-- Tâches : des listes favorites (demande de Jules, 13/10/2026).
--
-- Une liste favorite passe en tête de la barre des listes, mise en
-- évidence. Un simple drapeau : l'ordre des listes (`position`) ne bouge
-- pas, l'écran met les favorites devant. Rejouable sans casse.
-- =====================================================================

alter table public.taches_lists
  add column if not exists favorite boolean not null default false;
