-- =====================================================================
--  Éclipse — migration : tables du module calendrier (étape 1)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Deux tables, préfixées `calendar_`, avec RLS — conception complète dans
--  docs/etude-calendrier.md §7 et §12.
--
--  On stocke la RÈGLE d'une série, jamais ses occurrences : elles se
--  calculent à l'affichage (lib/recurrence.ts, étape 2), comme le solde d'une
--  enveloppe d'Astra. Les heures sont LOCALES, avec leur fuseau à côté :
--  « tous les mardis à 9 h » doit rester 9 h après le passage à l'heure
--  d'hiver, ce qu'un calcul en UTC ne garantit pas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Un événement, ou une série.
--
-- Journée entière : pas d'heure (`start_time`/`end_time` nulles), du jour de
-- début au jour de fin inclus. Horaire : les deux heures, et la fin après le
-- début — ou le lendemain et plus (« 21 h – 2 h »).
--
-- `recurrence` : nulle = ponctuel ; sinon un objet JSON
-- { freq, interval, byWeekday?, until?, count? } — sous-ensemble de la
-- RRULE (RFC 5545), étude §3. Seule sa fréquence est contrôlée ici ; le
-- reste l'est par TypeScript, testé.
-- ---------------------------------------------------------------------
create table if not exists public.calendar_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 120),
  all_day    boolean not null default false,
  start_day  date not null,
  end_day    date not null,
  start_time time,
  end_time   time,
  timezone   text not null default 'Europe/Paris' check (char_length(timezone) between 1 and 64),
  recurrence jsonb,
  color      text not null default 'bleu'
             constraint calendar_events_color_check
             check (color in ('bleu', 'vert', 'orange', 'rose', 'violet', 'gris')),
  location   text not null default '' check (char_length(location) <= 200),
  note       text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  constraint calendar_events_days_check check (end_day >= start_day),
  constraint calendar_events_times_check check (
    (all_day and start_time is null and end_time is null)
    or (not all_day and start_time is not null and end_time is not null
        and (end_day > start_day or end_time > start_time))
  ),
  constraint calendar_events_freq_check check (
    recurrence is null
    or recurrence->>'freq' = any (array['daily', 'weekly', 'monthly', 'yearly'])
  )
);

create index if not exists calendar_events_user_idx
  on public.calendar_events (user_id, start_day);

-- ---------------------------------------------------------------------
-- Une occurrence d'une série supprimée (`skip`) ou modifiée (`override`) :
-- « tous les mardis, sauf le 14 », « celui du 21 à 19 h ». Désignée par le
-- jour qu'elle aurait eu dans la série ; une seule exception par jour.
-- Supprimer la série emporte ses exceptions.
-- ---------------------------------------------------------------------
create table if not exists public.calendar_exceptions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  event_id       uuid not null references public.calendar_events (id) on delete cascade,
  occurrence_day date not null,
  kind           text not null
                 constraint calendar_exceptions_kind_check
                 check (kind in ('skip', 'override')),
  override       jsonb,
  created_at     timestamptz not null default now(),
  constraint calendar_exceptions_occurrence_key unique (event_id, occurrence_day),
  constraint calendar_exceptions_override_check check ((kind = 'override') = (override is not null))
);

create index if not exists calendar_exceptions_user_idx
  on public.calendar_exceptions (user_id, event_id);

-- ---------------------------------------------------------------------
-- Row Level Security : chaque compte ne voit et ne modifie que ses lignes.
-- Motif copié de schema.sql — quatre politiques par table.
-- ---------------------------------------------------------------------
alter table public.calendar_events enable row level security;
alter table public.calendar_exceptions enable row level security;

drop policy if exists "calendar_events_select_own" on public.calendar_events;
create policy "calendar_events_select_own" on public.calendar_events
  for select using (auth.uid() = user_id);
drop policy if exists "calendar_events_insert_own" on public.calendar_events;
create policy "calendar_events_insert_own" on public.calendar_events
  for insert with check (auth.uid() = user_id);
drop policy if exists "calendar_events_update_own" on public.calendar_events;
create policy "calendar_events_update_own" on public.calendar_events
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "calendar_events_delete_own" on public.calendar_events;
create policy "calendar_events_delete_own" on public.calendar_events
  for delete using (auth.uid() = user_id);

drop policy if exists "calendar_exceptions_select_own" on public.calendar_exceptions;
create policy "calendar_exceptions_select_own" on public.calendar_exceptions
  for select using (auth.uid() = user_id);
drop policy if exists "calendar_exceptions_insert_own" on public.calendar_exceptions;
create policy "calendar_exceptions_insert_own" on public.calendar_exceptions
  for insert with check (auth.uid() = user_id);
drop policy if exists "calendar_exceptions_update_own" on public.calendar_exceptions;
create policy "calendar_exceptions_update_own" on public.calendar_exceptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "calendar_exceptions_delete_own" on public.calendar_exceptions;
create policy "calendar_exceptions_delete_own" on public.calendar_exceptions
  for delete using (auth.uid() = user_id);
