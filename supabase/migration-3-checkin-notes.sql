-- =====================================================================
--  Zénith — migration : note libre sur les check-ins
--  À coller dans Supabase Studio > SQL Editor > Run.
--  Idempotent : peut être relancé sans risque.
-- =====================================================================

alter table public.checkins
  add column if not exists note text not null default '';
