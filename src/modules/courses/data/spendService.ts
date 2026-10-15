import type { ShoppingSpendService, ShoppingSpendTrip } from '../../../core/lib/services';
import { tripRef } from '../lib/budgetLink';
import {
  classify,
  FOOD_KIND_LABELS,
  FOOD_KINDS,
  tripSpend,
  TYPOLOGIES,
  TYPOLOGY_EMOJIS,
  TYPOLOGY_LABELS,
  type FoodKind,
  type Typology,
} from '../lib/typology';
import type { CoursesStore } from './coursesStore';

/**
 * Le service `shoppingSpend` que Courses rend à Budget
 * (docs/etude-courses-typologies.md §4) : pour les dépenses que Courses a
 * créées dans Budget, le contenu de chaque course, classé. Tout est
 * recalculé à chaque demande depuis les courses et le catalogue : rien n'est
 * copié dans Budget.
 */
export function createSpendService(store: CoursesStore): ShoppingSpendService {
  return {
    typologies: TYPOLOGIES.map((t) => ({ id: t, label: TYPOLOGY_LABELS[t], emoji: TYPOLOGY_EMOJIS[t] })),
    foodTypology: 'alimentation',
    foodKinds: FOOD_KINDS.map((k) => ({ id: k, label: FOOD_KIND_LABELS[k] })),

    async trips(refs) {
      if (refs.length === 0) return [];
      const wanted = new Set(refs);
      const [trips, tripItems, items] = await Promise.all([store.listTrips(), store.listTripItems(), store.listItems()]);
      const itemOf = new Map(items.map((i) => [i.id, i]));
      const result: ShoppingSpendTrip[] = [];
      for (const trip of trips) {
        const ref = tripRef(trip);
        if (!wanted.has(ref)) continue;
        const lines = tripItems
          .filter((l) => l.tripId === trip.id)
          .map((l) => {
            const item = l.itemId ? itemOf.get(l.itemId) : undefined;
            return {
              id: l.id,
              itemId: l.itemId,
              name: l.name,
              quantity: l.quantity,
              cents: l.priceCents,
              classification: classify(
                l.typology ? { typology: l.typology, foodKind: l.foodKind ?? null } : null,
                item?.typology ? { typology: item.typology, foodKind: item.foodKind ?? null } : null,
                l.name,
                l.aisle,
              ),
            };
          });
        const spend = tripSpend(trip.totalCents, lines);
        result.push({
          ref,
          day: trip.day,
          store: trip.storeName,
          totalCents: trip.totalCents,
          lines: lines.map((l) => ({
            id: l.id,
            name: l.name,
            quantity: l.quantity,
            cents: l.cents,
            typology: l.classification.typology,
            foodKind: l.classification.foodKind,
          })),
          byKey: Object.fromEntries(spend.byKey),
          adjustmentCents: spend.adjustmentCents,
          undetailedCents: spend.undetailedCents,
        });
      }
      return result;
    },

    async classify(lineId, typology, foodKind) {
      if (typology !== null && !(TYPOLOGIES as readonly string[]).includes(typology)) throw new Error('Typologie inconnue.');
      if (foodKind !== null && !(FOOD_KINDS as readonly string[]).includes(foodKind)) throw new Error('Sorte inconnue.');
      const line = (await store.listTripItems()).find((l) => l.id === lineId);
      if (!line) throw new Error('Cette ligne de course n’existe plus.');
      const t = typology as Typology | null;
      const k = t === 'alimentation' ? ((foodKind as FoodKind | null) ?? 'essentiel') : null;
      // Un article du catalogue : c'est lui qu'on reclasse, ses courses passées le suivent.
      if (line.itemId) await store.updateItem(line.itemId, { typology: t, foodKind: k });
      else await store.classifyTripItem(line.id, t, k);
    },
  };
}
