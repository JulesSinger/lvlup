import { coreStore } from '../../../core/data';
import { plannedReminders } from '../lib/reminders';
import { sportStore } from './index';

/** La dernière déclaration envoyée : inutile de la refaire si rien n'a changé. */
let lastSent = '';

/**
 * Déclare au socle les rappels à venir de Sport (`lib/reminders.ts`). Appelé
 * après chaque chargement de l'écran et chaque geste dans le calendrier. Même
 * motif que Projets et Tâches ; sans effet en mode local.
 */
export async function syncReminders(): Promise<void> {
  if (!coreStore.isRemote) return;
  const [runs, plans, sessions] = await Promise.all([sportStore.listRuns(), sportStore.listPlans(), sportStore.listSessions()]);
  const planned = plannedReminders({ runs, plans, sessions }, new Date());
  const key = JSON.stringify(planned);
  if (key === lastSent) return;
  await coreStore.scheduleReminders('sport', planned);
  lastSent = key;
}
