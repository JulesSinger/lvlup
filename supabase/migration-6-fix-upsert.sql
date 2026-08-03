-- =====================================================================
--  Zénith — correctif : « no unique or exclusion constraint matching the
--  ON CONFLICT specification » au clic sur une action.
--
--  Cause : la migration 5 posait un index UNIQUE PARTIEL
--  (`where action_id is not null`). Postgres refuse d'utiliser un index
--  partiel pour inférer un ON CONFLICT, donc chaque upsert échouait.
--
--  Correctif : une vraie contrainte UNIQUE. Les anciennes lignes sans
--  action gardent leur place — par défaut Postgres considère deux NULL
--  comme distincts, elles ne peuvent donc pas entrer en conflit.
--
--  À coller dans Supabase Studio > SQL Editor > Run.
--  Idempotent : peut être relancé sans risque.
-- =====================================================================

drop index if exists public.checkins_action_day_uidx;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'checkins_user_action_day_key'
  ) then
    alter table public.checkins
      add constraint checkins_user_action_day_key unique (user_id, action_id, day);
  end if;
end $$;
