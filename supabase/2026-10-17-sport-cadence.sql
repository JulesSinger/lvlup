-- =====================================================================
--  Sport — la cadence des sorties, en pas par minute (demande de Jules du
--  17/10/2026). À coller dans Supabase Studio > SQL Editor > Run.
--  Idempotent.
--
--  `avg_cadence` : la cadence moyenne, les deux pieds (Strava et les
--  fichiers FIT comptent souvent une seule jambe : l'app double avant de
--  ranger, `lib/cadence.ts`). Et une date sur le lien Strava : la reprise de
--  la cadence des sorties déjà là ne se fait qu'une fois.
-- =====================================================================

alter table public.sport_runs
  add column if not exists avg_cadence smallint;

alter table public.sport_runs
  drop constraint if exists sport_runs_avg_cadence_check,
  add constraint sport_runs_avg_cadence_check
    check (avg_cadence between 100 and 260);

alter table public.sport_strava_links
  add column if not exists cadence_backfilled_at timestamptz;
