/**
 * Les rappels des modules (table `reminders`, depuis le 28/09/2026) — la
 * règle d'envoi, pure et testée (`src/core/lib/moduleReminders.test.ts`).
 *
 * Un rappel part quand son heure est venue. Un rappel en retard de plus
 * d'une heure (fonction arrêtée, cron en panne) est abandonné plutôt
 * qu'envoyé : « Appeler le garage — 9 h » reçu à midi n'aide personne.
 */

export const LATE_LIMIT_MINUTES = 60;
/** Les rappels envoyés sont effacés passé ce délai : la table reste petite. */
export const KEEP_SENT_DAYS = 7;

export interface ModuleReminderRow {
  id: string;
  user_id: string;
  module: string;
  ref: string;
  title: string;
  body: string;
  url: string;
  fire_at: string;
}

/** Parmi les rappels pas encore envoyés dont l'heure est passée : ceux à envoyer, ceux à abandonner. */
export function splitDue(rows: readonly ModuleReminderRow[], now: Date): { send: ModuleReminderRow[]; expire: ModuleReminderRow[] } {
  const limit = now.getTime() - LATE_LIMIT_MINUTES * 60_000;
  const send: ModuleReminderRow[] = [];
  const expire: ModuleReminderRow[] = [];
  for (const row of rows) {
    const at = new Date(row.fire_at).getTime();
    if (at > now.getTime()) continue;
    (at >= limit ? send : expire).push(row);
  }
  return { send, expire };
}

/** Ce que reçoit le service worker : l'étiquette regroupe les rappels d'une même chose. */
export function payloadFor(row: ModuleReminderRow) {
  return { title: row.title, body: row.body, tag: `${row.module}-${row.ref}`, url: row.url || '/' };
}
