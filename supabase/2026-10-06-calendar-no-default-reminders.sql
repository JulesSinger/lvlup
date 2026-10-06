-- =====================================================================
--  Atlas — migration : plus de rappel par défaut pour les événements
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Décision de Jules (06/10/2026) : les tâches préviennent à leur heure
--  (Tâches), mais un événement du calendrier ne prévient que si on lui a
--  choisi un rappel. Le défaut passe de « 15 min avant » à aucun, comme
--  `DEFAULT_CALENDAR_SETTINGS` (src/modules/calendrier/lib/types.ts).
-- =====================================================================

alter table public.calendar_settings alter column timed_reminders set default '{}';
alter table public.calendar_settings alter column all_day_reminders set default '{}';

-- Les réglages déjà enregistrés passent aussi à « aucun » : c'est la décision,
-- pas seulement un nouveau défaut pour les comptes à venir. Un défaut se
-- remet dans Réglages → Rappels du calendrier.
update public.calendar_settings
   set timed_reminders = '{}', all_day_reminders = '{}', updated_at = now()
 where timed_reminders <> '{}' or all_day_reminders <> '{}';

-- Les rappels déjà planifiés d'événements qui suivaient le défaut
-- (`reminders` à null) : retirés tout de suite, sans attendre la prochaine
-- ouverture du calendrier. Ceux d'un événement qui a ses propres rappels
-- restent. La référence est « event:<id>:<jour>:<décalage> ».
delete from public.reminders r
 using public.calendar_events e
 where r.module = 'calendrier'
   and r.sent_at is null
   and e.user_id = r.user_id
   and e.reminders is null
   and r.ref like 'event:' || e.id::text || ':%';
