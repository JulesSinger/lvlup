import type { SeriesPlan } from '../lib/seriesEdit';
import type { CalendarStore } from './calendarStore';

/**
 * Applique les écritures d'une modification de série (`lib/seriesEdit.ts`)
 * par le seul contrat de stockage.
 *
 * L'ordre compte, parce que ces écritures ne forment pas une transaction :
 * pour « les suivants », la nouvelle série est **créée avant** que
 * l'ancienne soit raccourcie. Une coupure réseau entre les deux laisse donc
 * au pire des occurrences en double, visibles et faciles à retirer — jamais
 * des occurrences disparues.
 */
export async function applyPlan(store: CalendarStore, plan: SeriesPlan): Promise<void> {
  const created = plan.create ? await store.createEvent(plan.create) : null;
  if (plan.update) await store.updateEvent(plan.update.id, plan.update.patch);
  if (plan.setException) {
    const { eventId, occurrenceDay, kind, override } = plan.setException;
    await store.setException(eventId, occurrenceDay, kind, override);
  }
  for (const id of plan.deleteExceptions) await store.deleteException(id);
  // Les variantes choisies à la main, sur la série qui les porte désormais.
  const target = created?.id ?? plan.update?.id;
  if (target) for (const c of plan.carry ?? []) await store.setException(target, c.occurrenceDay, 'override', c.override);
  if (plan.deleteEvent) await store.deleteEvent(plan.deleteEvent);
}
