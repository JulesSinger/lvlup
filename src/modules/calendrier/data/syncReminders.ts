import { coreStore } from '../../../core/data';
import { plannedReminders } from '../lib/reminders';
import type { CalendarEvent, CalendarSettings, EventException } from '../lib/types';
import { calendarStore } from './index';

/** La dernière déclaration envoyée : inutile de la refaire si rien n'a changé. */
let lastSent = '';

/**
 * Déclare au socle les rappels à venir d'Éclipse (`lib/reminders.ts`),
 * recalculés depuis les événements et les réglages. Appelé après chaque
 * chargement de l'écran (donc après chaque écriture, qui recharge) et chaque
 * changement de réglage. Même motif que Polaris.
 *
 * Sans effet en mode local (rien ne peut partir sans serveur). Un échec ne
 * gêne jamais le calendrier : il est rendu à l'appelant.
 */
export async function syncReminders(
  events?: readonly CalendarEvent[],
  exceptions?: readonly EventException[],
  settings?: CalendarSettings,
): Promise<void> {
  if (!coreStore.isRemote) return;
  const [allEvents, allExceptions, current] = await Promise.all([
    events ?? calendarStore.listEvents(),
    exceptions ?? calendarStore.listExceptions(),
    settings ?? calendarStore.getSettings(),
  ]);
  const planned = plannedReminders(allEvents, allExceptions, current, new Date());
  const key = JSON.stringify(planned);
  if (key === lastSent) return;
  await coreStore.scheduleReminders('calendrier', planned);
  lastSent = key;
}
