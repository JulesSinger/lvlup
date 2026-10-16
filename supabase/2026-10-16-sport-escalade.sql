-- =====================================================================
--  Sport — l'escalade, une séance d'à côté comme le renfo et le vélo
--  (demande de Jules du 16/10/2026). À coller dans Supabase Studio >
--  SQL Editor > Run. Idempotent.
--
--  Une sorte de plus dans le plan (`sport_plan_sessions.kind`) et pour les
--  activités venues de Strava (`sport_activities.sport`, type RockClimbing).
-- =====================================================================

alter table public.sport_plan_sessions
  drop constraint if exists sport_plan_sessions_kind_check,
  add constraint sport_plan_sessions_kind_check
    check (kind in ('footing', 'fractionne', 'seuil', 'longue', 'allure', 'course', 'renfo', 'velo', 'escalade'));

alter table public.sport_activities
  drop constraint if exists sport_activities_sport_check,
  add constraint sport_activities_sport_check
    check (sport in ('renfo', 'velo', 'escalade'));
