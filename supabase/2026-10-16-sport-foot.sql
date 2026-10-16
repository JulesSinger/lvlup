-- =====================================================================
--  Sport — le foot (un five en salle), une séance d'à côté comme
--  l'escalade (demande de Jules du 16/10/2026). À coller dans Supabase
--  Studio > SQL Editor > Run, après 2026-10-16-sport-escalade.sql.
--  Idempotent.
--
--  Une sorte de plus dans le plan (`sport_plan_sessions.kind`) et pour les
--  activités venues de Strava (`sport_activities.sport`, type Soccer).
-- =====================================================================

alter table public.sport_plan_sessions
  drop constraint if exists sport_plan_sessions_kind_check,
  add constraint sport_plan_sessions_kind_check
    check (kind in ('footing', 'fractionne', 'seuil', 'longue', 'allure', 'course', 'renfo', 'velo', 'escalade', 'foot'));

alter table public.sport_activities
  drop constraint if exists sport_activities_sport_check,
  add constraint sport_activities_sport_check
    check (sport in ('renfo', 'velo', 'escalade', 'foot'));
