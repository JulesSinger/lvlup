-- =====================================================================
--  Polaris — migration : des titres de tâche jusqu'à 1000 caractères
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Demande de Jules (28/09/2026) : 200 caractères ne suffisaient pas. La
--  contrainte d'origine (2026-09-27-taches-tables.sql), nommée
--  automatiquement par Postgres, est remplacée par une contrainte nommée,
--  comparée par `lib/schema.test.ts` à `TASK_TITLE_MAX`.
-- =====================================================================

alter table public.taches_tasks drop constraint if exists taches_tasks_title_check;
alter table public.taches_tasks add constraint taches_tasks_title_check
  check (char_length(title) between 1 and 1000);
