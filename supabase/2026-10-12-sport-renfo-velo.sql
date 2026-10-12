-- =====================================================================
--  Sport — des séances de renforcement et de vélo dans le plan
--  (docs/etude-sport.md §23, demande de Jules du 12/10/2026 : son coach en
--  programme). À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Deux sortes de séance de plus, et `done_at` : aucune sortie ne fait une
--  séance de renforcement ou de vélo, on la coche à la main.
-- =====================================================================

alter table public.sport_plan_sessions
  drop constraint if exists sport_plan_sessions_kind_check,
  add constraint sport_plan_sessions_kind_check
    check (kind in ('footing', 'fractionne', 'seuil', 'longue', 'allure', 'course', 'renfo', 'velo')),
  add column if not exists done_at timestamptz;
