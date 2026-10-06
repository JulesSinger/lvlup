import { coreStore } from '../../../core/data';
import { plannedReminders } from '../lib/reminders';
import { projetsStore } from './index';

/** La dernière déclaration envoyée : inutile de la refaire si rien n'a changé. */
let lastSent = '';

/**
 * Déclare au socle les rappels à venir de Projets (`lib/reminders.ts`),
 * recalculés depuis les projets, leurs tâches et leurs paiements. Appelé
 * après chaque chargement de l'écran (donc après chaque écriture) et chaque
 * geste dans le calendrier. Même motif que Tâches et Calendar.
 *
 * Sans effet en mode local (rien ne peut partir sans serveur). Un échec ne
 * gêne jamais les projets : il est rendu à l'appelant.
 */
export async function syncReminders(): Promise<void> {
  if (!coreStore.isRemote) return;
  const [clients, projects, tasks, payments] = await Promise.all([
    projetsStore.listClients(),
    projetsStore.listProjects(),
    projetsStore.listTasks(),
    projetsStore.listPayments(),
  ]);
  const planned = plannedReminders({ clients, projects, tasks, payments }, new Date());
  const key = JSON.stringify(planned);
  if (key === lastSent) return;
  await coreStore.scheduleReminders('projets', planned);
  lastSent = key;
}
