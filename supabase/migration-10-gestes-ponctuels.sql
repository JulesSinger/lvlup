-- ---------------------------------------------------------------------
-- Migration 10 — les gestes ponctuels
--
-- « J'ai regardé un tuto sur comment tenir un budget. » C'est un vrai pas
-- vers l'objectif, mais pas une habitude : en faire une action permanente
-- polluerait l'écran du soir pour toujours, et ne rien noter laisserait une
-- case vide dans la grille un jour où on a vraiment avancé.
--
-- Le modèle était déjà presque prêt : `action_id` est nullable, et la
-- contrainte UNIQUE (user_id, action_id, day) traite les NULL comme
-- distincts — plusieurs gestes ponctuels le même jour passent donc sans rien
-- changer. Il ne manquait que de quoi les nommer.
--
-- Une seule colonne, nullable :
--   · null      → réalisation ordinaire, c'est l'action qui la nomme ;
--   · non null  → geste ponctuel, qui porte son propre titre.
--
-- Ce champ est aussi ce qui distingue un geste ponctuel d'une réalisation
-- dont l'action a été supprimée (`action_id` passe à null) : le premier ne
-- compte jamais dans un palier, la seconde garde ses droits acquis.
--
-- Sans risque et rejouable.
-- ---------------------------------------------------------------------

alter table public.checkins
  add column if not exists title text;

-- Un titre vide n'a pas de sens : soit il y en a un, soit la colonne est nulle.
alter table public.checkins
  drop constraint if exists checkins_title_check;
alter table public.checkins
  add constraint checkins_title_check
  check (title is null or length(btrim(title)) > 0);

-- Un geste ponctuel n'a pas d'action ; une réalisation ordinaire n'a pas de
-- titre. La contrainte interdit les états bâtards.
alter table public.checkins
  drop constraint if exists checkins_title_or_action_check;
alter table public.checkins
  add constraint checkins_title_or_action_check
  check (title is null or action_id is null);
