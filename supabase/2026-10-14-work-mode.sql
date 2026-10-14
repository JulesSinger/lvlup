-- =====================================================================
-- Atlas : le mode « au travail » (demande de Jules, 14/10/2026).
--
-- Un interrupteur rangé avec le compte (`profiles.work_mode`) : seuls les
-- modules de `work_modules` restent visibles, et ils ne montrent que ce qui
-- est marqué « travail » — les listes de Tâches (`taches_lists.work`) et les
-- événements du calendrier (`calendar_events.work`), les autres événements
-- devenant de simples blocs « Occupé ». Un affichage, pas une protection :
-- les données restent celles du compte. Rejouable sans casse.
-- =====================================================================

alter table public.profiles
  add column if not exists work_mode boolean not null default false;

alter table public.profiles
  add column if not exists work_modules text[] not null default '{taches,calendrier}';

alter table public.taches_lists
  add column if not exists work boolean not null default false;

alter table public.calendar_events
  add column if not exists work boolean not null default false;
