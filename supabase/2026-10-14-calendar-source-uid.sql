-- Importer un calendrier (.ics) sans doublon — docs/etude-calendrier.md §20.
--
-- Chaque événement importé garde l'identifiant qu'il avait dans son calendrier
-- d'origine (le `UID` d'Apple). Réimporter le même fichier n'ajoute que ce qui
-- est nouveau ; un événement créé dans Atlas n'en a pas (null), et une
-- contrainte unique laisse passer autant de null qu'on veut.
--
-- Rejouable.

alter table public.calendar_events add column if not exists source_uid text;

alter table public.calendar_events drop constraint if exists calendar_events_source_uid_check;
alter table public.calendar_events add constraint calendar_events_source_uid_check
  check (source_uid is null or char_length(source_uid) between 1 and 300);

alter table public.calendar_events drop constraint if exists calendar_events_source_uid_key;
alter table public.calendar_events add constraint calendar_events_source_uid_key unique (user_id, source_uid);
