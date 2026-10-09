import { coreStore } from '../../../core/data';
import { plannedReminders } from '../lib/anniversaries';
import { hautsFaitsStore } from './index';

/** La dernière déclaration envoyée : inutile de la refaire si rien n'a changé. */
let lastSent = '';

/**
 * Déclare au socle le rappel « Ce jour-là » des trente prochains jours
 * (`lib/anniversaries.ts`), ou rien s'il est coupé — ce qui retire ce qui
 * était prévu. Appelé après chaque chargement de l'écran et chaque réglage.
 * Même motif que Projets. Sans effet en mode local.
 */
export async function syncReminders(): Promise<void> {
  if (!coreStore.isRemote) return;
  const [feats, settings] = await Promise.all([hautsFaitsStore.listFeats(), hautsFaitsStore.getSettings()]);
  const planned = plannedReminders(feats, settings.onThisDayReminder, new Date());
  const key = JSON.stringify(planned);
  if (key === lastSent) return;
  await coreStore.scheduleReminders('hautsfaits', planned);
  lastSent = key;
}
