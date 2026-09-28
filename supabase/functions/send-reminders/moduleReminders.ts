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

/**
 * Une notification push porte au plus 4096 octets une fois chiffrée (RFC
 * 8291 : 86 octets d'en-tête et 17 de chiffrement, reste ~3990 pour le
 * texte) : on garde une marge. Titre et texte vont jusqu'à 1000 caractères chacun, ce qui
 * tient largement en français ; seul un cas extrême (des centaines d'emojis,
 * 4 octets chacun) dépasserait — le texte est alors raccourci plutôt que
 * l'envoi refusé par le service de push.
 */
export const MAX_PAYLOAD_BYTES = 3800;

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

/** Ce que reçoit le service worker : l'étiquette regroupe les rappels d'une même chose. */
export function payloadFor(row: ModuleReminderRow) {
  const payload = { title: row.title, body: row.body, tag: `${row.module}-${row.ref}`, url: row.url || '/' };
  if (bytes(payload) <= MAX_PAYLOAD_BYTES) return payload;
  // Raccourcir le texte d'abord, puis le titre s'il le faut, lettre par lettre (sans couper un emoji).
  const chars = { title: [...row.title], body: [...row.body] };
  while (bytes(payload) > MAX_PAYLOAD_BYTES && chars.body.length > 0) {
    chars.body = chars.body.slice(0, Math.floor(chars.body.length * 0.9));
    payload.body = `${chars.body.join('')}…`;
  }
  while (bytes(payload) > MAX_PAYLOAD_BYTES && chars.title.length > 1) {
    chars.title = chars.title.slice(0, Math.floor(chars.title.length * 0.9));
    payload.title = `${chars.title.join('')}…`;
  }
  return payload;
}
