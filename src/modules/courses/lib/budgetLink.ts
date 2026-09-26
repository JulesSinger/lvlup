/**
 * Le lien avec le budget — bibliothèque pure (étape 6, docs/etude-courses.md
 * §18). Comète ne connaît pas Astra : elle décrit la dépense, le service du
 * socle (`core/lib/services.ts`) la transmet à qui sait l'enregistrer.
 */
import type { ExpenseRequest } from '../../../core/lib/services';
import type { Trip } from './types';

/** La catégorie demandée au budget — celle des catégories de départ d'Astra. */
export const BUDGET_CATEGORY = 'Courses';

/**
 * La référence d'une course côté budget. Le numéro de course plutôt que
 * l'identifiant en base : une restauration de sauvegarde régénère les
 * identifiants, mais garde les numéros — le lien survit donc à une
 * restauration.
 */
export function tripRef(trip: Pick<Trip, 'number'>): string {
  return `comete:course:${trip.number}`;
}

/** La dépense qui correspond à une course : son total, son jour, son magasin. */
export function expenseForTrip(trip: Pick<Trip, 'number' | 'day' | 'storeName' | 'totalCents'>): ExpenseRequest {
  return {
    ref: tripRef(trip),
    day: trip.day,
    label: trip.storeName ? `Courses — ${trip.storeName}` : 'Courses',
    amountCents: trip.totalCents,
    categoryName: BUDGET_CATEGORY,
    note: `Comète, course n° ${trip.number}`,
  };
}
