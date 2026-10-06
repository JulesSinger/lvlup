-- =====================================================================
--  Atlas — migration : les rappels de chaque tâche (Tâches)
--  À coller dans Supabase Studio > SQL Editor > Run. Idempotent.
--
--  Décision de Jules (06/10/2026) : une tâche choisit ses rappels comme un
--  événement du calendrier — deux au plus, de « à l'heure » à « 1 jour
--  avant », en minutes avant son heure. `null` : celui par défaut des
--  réglages (« à l'heure »), ce qui laisse toutes les tâches d'avant comme
--  elles étaient ; `{}` : aucun, choisi. Pendant de `TASK_REMINDERS` et
--  `MAX_TASK_REMINDERS` (src/modules/taches/lib/types.ts), comparés par
--  `lib/schema.test.ts`. Rien à redéployer : l'app calcule et déclare.
-- =====================================================================

alter table public.taches_tasks add column if not exists reminders integer[];

alter table public.taches_tasks drop constraint if exists taches_tasks_reminders_check;
alter table public.taches_tasks add constraint taches_tasks_reminders_check
  check (reminders is null or (cardinality(reminders) <= 2 and reminders <@ array[0, 5, 10, 15, 30, 60, 120, 1440]));
