-- =====================================================================
--  Zénith — le cumul multi-actions peut être masqué par objectif
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  `track_amount` est nullable à dessein : `null` veut dire « automatique »
--  (affiché seulement quand l'objectif a une quantité à sommer), et
--  `true`/`false` un choix explicite de l'utilisateur, qui prime toujours
--  sur l'automatique — voir docs/etude-paliers-comptables.md §14.
-- =====================================================================

alter table public.goals
  add column if not exists track_amount boolean;
