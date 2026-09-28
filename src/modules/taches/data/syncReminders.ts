import { coreStore } from '../../../core/data';
import { plannedReminders } from '../lib/reminders';
import type { TachesSettings, Task } from '../lib/types';
import { tachesStore } from './index';

/** La dernière déclaration envoyée : inutile de la refaire si rien n'a changé. */
let lastSent = '';

/**
 * Déclare au socle les rappels à venir de Polaris (`lib/reminders.ts`),
 * recalculés depuis les tâches et les réglages. Appelé après chaque
 * chargement de l'écran et chaque changement de réglage : tous les appareils
 * partent des mêmes données, et déclarent donc les mêmes rappels.
 *
 * Sans effet en mode local (rien ne peut partir sans serveur). Un échec ne
 * gêne jamais les tâches elles-mêmes : il est rendu à l'appelant, qui décide
 * de le montrer ou non.
 */
export async function syncReminders(tasks?: readonly Task[], settings?: TachesSettings): Promise<void> {
  if (!coreStore.isRemote) return;
  const [allTasks, current] = await Promise.all([tasks ?? tachesStore.listTasks(), settings ?? tachesStore.getSettings()]);
  const planned = plannedReminders(allTasks, current, new Date());
  const key = JSON.stringify(planned);
  if (key === lastSent) return;
  await coreStore.scheduleReminders('taches', planned);
  lastSent = key;
}
