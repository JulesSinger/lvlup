-- =====================================================================
--  Polaris — migration : la durée d'une tâche, facultative
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Demande de Jules (28/09/2026) : une tâche à 15 h prenait 30 minutes dans
--  le calendrier d'Éclipse, sans moyen de changer. La durée, en minutes, ne
--  sert qu'à une tâche qui a une heure ; sans durée, le calendrier garde
--  30 minutes.
-- =====================================================================

alter table public.taches_tasks add column if not exists duration_minutes integer;

alter table public.taches_tasks drop constraint if exists taches_tasks_duration_check;
alter table public.taches_tasks add constraint taches_tasks_duration_check
  check (duration_minutes is null or (duration_minutes between 5 and 1440 and planned_time is not null));
