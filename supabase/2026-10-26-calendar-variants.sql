-- =====================================================================
-- Calendar : les variantes d'une série (demande de Jules, 26/10/2026).
--
-- « Travail », tous les jours de la semaine, au bureau ou en télétravail :
-- le même événement, dont chaque jour porte une variante. La liste vit sur
-- la série (`variants`, jsonb : [{ id, name, color, weekdays }]) ; le choix
-- d'un jour vit dans l'exception de l'occurrence (`override.variant`, déjà
-- en jsonb, rien à changer). Règles détaillées dans
-- src/modules/calendrier/lib/variants.ts. Rejouable sans casse.
-- =====================================================================

alter table public.calendar_events
  add column if not exists variants jsonb not null default '[]'::jsonb;

alter table public.calendar_events
  drop constraint if exists calendar_events_variants_check;

alter table public.calendar_events
  add constraint calendar_events_variants_check
  check (jsonb_typeof(variants) = 'array' and jsonb_array_length(variants) <= 6);
