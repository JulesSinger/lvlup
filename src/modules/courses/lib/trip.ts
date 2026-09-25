/**
 * La clôture d'une course et la récurrence — bibliothèque pure, la règle la
 * plus importante du module (docs/etude-courses.md §3, §12).
 *
 * « Terminer la course » :
 *  · les lignes cochées sont archivées dans la course, prix et noms figés ;
 *  · elles quittent la liste ;
 *  · les articles habituels qui seront dus à la course suivante y sont
 *    remis ;
 *  · les lignes non cochées restent (rupture de stock, oubli).
 *
 * Le résultat est un `ClosePlan`, que le stockage applique d'un bloc
 * (`courses_close_trip` côté Supabase) sans connaître cette règle.
 */
import type { ClosePlan, Item, ListEntry, Trip } from './types';

/** Les choix proposés à l'écran : ponctuel, puis toutes les N courses. */
export const RECURRENCE_CHOICES: readonly (number | null)[] = [null, 1, 2, 3, 4, 6, 8];

export function recurrenceLabel(recurrence: number | null): string {
  if (recurrence === null) return 'ponctuel';
  if (recurrence === 1) return 'à chaque course';
  return `toutes les ${recurrence} courses`;
}

/** Le numéro de la prochaine course : 1 pour la toute première. */
export function nextTripNumber(trips: readonly Pick<Trip, 'number'>[]): number {
  return trips.reduce((max, t) => Math.max(max, t.number), 0) + 1;
}

/**
 * Un article habituel est-il à acheter pour la course n° `tripNumber` ?
 *
 * Acheté à la course n° k avec une récurrence N, il revient pour la course
 * n° k + N (N = 1 : dès la suivante). Un habituel jamais encore acheté est
 * toujours dû. Un ponctuel ne l'est jamais : il ne revient que si on le
 * remet soi-même.
 */
export function isDue(item: Pick<Item, 'recurrence' | 'lastTripNumber'>, tripNumber: number): boolean {
  if (item.recurrence === null) return false;
  if (item.lastTripNumber === null) return true;
  return tripNumber - item.lastTripNumber >= item.recurrence;
}

/** Le total proposé pour la course : la somme des prix saisis. Le ticket, lui, fait foi. */
export function suggestedTotal(entries: readonly ListEntry[]): { totalCents: number; priced: number; unpriced: number } {
  const checked = entries.filter((e) => e.checked);
  const priced = checked.filter((e) => e.priceCents !== null);
  return {
    totalCents: priced.reduce((sum, e) => sum + (e.priceCents ?? 0), 0),
    priced: priced.length,
    unpriced: checked.length - priced.length,
  };
}

export interface CloseInput {
  items: readonly Item[];
  entries: readonly ListEntry[];
  trips: readonly Pick<Trip, 'number'>[];
  day: string;
  store: { id: string | null; name: string };
  /** Le total du ticket ; à défaut, la somme des prix saisis */
  totalCents?: number;
  note?: string;
}

/**
 * Calcule tout ce que « terminer la course » écrit.
 *
 * Une course sans rien de coché est refusée : ce serait une course vide
 * enregistrée par erreur, qui ferait en plus avancer l'horloge de la
 * récurrence pour rien.
 */
export function buildClosePlan(input: CloseInput): ClosePlan {
  const byId = new Map(input.items.map((i) => [i.id, i]));
  const bought = input.entries.filter((e) => e.checked && byId.has(e.itemId));
  if (bought.length === 0) throw new Error('Coche au moins un article avant de terminer la course.');

  const number = nextTripNumber(input.trips);
  const purchased = new Set(bought.map((e) => e.itemId));
  const remaining = new Set(input.entries.filter((e) => !e.checked).map((e) => e.itemId));

  // Après cette course, l'article acheté a pour dernière course `number` ;
  // on regarde s'il sera dû à la suivante.
  const addItemIds = input.items
    .filter((item) => !remaining.has(item.id))
    .filter((item) =>
      isDue({ ...item, lastTripNumber: purchased.has(item.id) ? number : item.lastTripNumber }, number + 1),
    )
    .map((item) => item.id);

  return {
    trip: {
      number,
      day: input.day,
      storeId: input.store.id,
      storeName: input.store.name,
      totalCents: input.totalCents ?? suggestedTotal(input.entries).totalCents,
      note: input.note ?? '',
    },
    items: bought.map((e) => {
      const item = byId.get(e.itemId) as Item;
      return { itemId: item.id, name: item.name, aisle: item.aisle, quantity: e.quantity, priceCents: e.priceCents };
    }),
    purchasedItemIds: [...purchased],
    removeEntryIds: bought.map((e) => e.id),
    addItemIds,
  };
}
