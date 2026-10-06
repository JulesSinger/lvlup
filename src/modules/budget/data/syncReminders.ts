import { coreStore } from '../../../core/data';
import { dayString } from '../../../core/lib/day';
import { plannedReminders } from '../lib/subscriptions';
import { budgetStore } from './index';

/** La dernière déclaration envoyée : inutile de la refaire si rien n'a changé. */
let lastSent = '';

/**
 * Déclare au socle les rappels de Budget : avant l'échéance des abonnements
 * qui le demandent (`lib/subscriptions.ts`). Appelé à l'ouverture de l'onglet
 * Abonnements et après chaque changement d'un abonnement. Même motif que
 * Tâches, Calendar et Projets.
 *
 * Sans effet en mode local (rien ne peut partir sans serveur). Un échec ne
 * gêne jamais le budget : il est rendu à l'appelant.
 */
export async function syncReminders(): Promise<void> {
  if (!coreStore.isRemote) return;
  const planned = plannedReminders(await budgetStore.listSubscriptions(), new Date(), dayString());
  const key = JSON.stringify(planned);
  if (key === lastSent) return;
  await coreStore.scheduleReminders('budget', planned);
  lastSent = key;
}
