import { newOpId, type QueuedOp } from '../../../core/data/outbox';
import type { ClosePlan, Item, ItemInput, ListEntry, ListEntryPatch, Store, Trip, TripItem } from '../lib/types';

/**
 * Les écritures de Courses en attente de réseau (09/11/2026) — leur forme et
 * leur réapplication à l'écran. Demande de Jules : « quand je vais en courses
 * à Auchan je n'ai plus de connexion, et je ne peux plus accéder ni mettre à
 * jour ma liste ». La décision du 25/09/2026 (pas de hors ligne en V1) tombe :
 * c'est exactement l'endroit où l'on n'a pas de réseau.
 *
 * Le stockage de la file et les règles de vidage sont ceux du socle
 * (`core/data/outbox.ts`). Chaque opération désigne ce qu'elle touche par un
 * identifiant choisi par l'app avant le premier envoi : rejouée, elle ne
 * double rien (`createItem(input, id)`, `addEntry(…, id)`, `createStore(name, id)`).
 * La clôture d'une course, elle, est reconnue au retour du réseau par son
 * numéro, son jour et son total (`courseWriter.ts`).
 */

/** La clé de la file. Un identifiant, pas un libellé : ne jamais la renommer. */
export const COURSES_OUTBOX_KEY = 'courses.outbox.v1';

export type CourseOp = QueuedOp &
  (
    | { kind: 'createItem'; itemId: string; input: ItemInput }
    | { kind: 'updateItem'; itemId: string; patch: Partial<ItemInput> }
    | { kind: 'deleteItem'; itemId: string }
    | { kind: 'addEntry'; entryId: string; itemId: string; quantity: string; note: string }
    | { kind: 'updateEntry'; entryId: string; patch: ListEntryPatch }
    | { kind: 'removeEntry'; entryId: string }
    | { kind: 'createStore'; storeId: string; name: string }
    /** `budget` : la dépense à créer dans Budget une fois la course partie (`null` : pas de dépense). */
    | { kind: 'closeTrip'; plan: ClosePlan; budget: { accountId?: string } | null }
  );

/** Ce qu'on fabrique pour la file : une opération sans son identifiant ni son heure. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type CourseChange = DistributiveOmit<CourseOp, 'id' | 'at'>;

/** Toutes les données de l'écran. */
export interface CourseData {
  items: Item[];
  entries: ListEntry[];
  stores: Store[];
  trips: Trip[];
  tripItems: TripItem[];
}

export function stamp(change: CourseChange, at = Date.now()): CourseOp {
  return { ...change, id: newOpId(), at } as CourseOp;
}

/**
 * Ajoute une opération à la file. Cocher, décocher, saisir un prix : deux
 * modifications d'une même ligne se fondent en une, tant qu'aucune course
 * terminée ne les sépare (la clôture a été calculée sur l'état d'alors).
 */
export function withOp(ops: readonly CourseOp[], op: CourseOp): CourseOp[] {
  if (op.kind === 'updateEntry') {
    for (let i = ops.length - 1; i >= 0; i--) {
      const prev = ops[i];
      if (prev.kind === 'closeTrip') break;
      if (prev.kind === 'updateEntry' && prev.entryId === op.entryId) {
        const merged = { ...prev, patch: { ...prev.patch, ...op.patch } };
        return ops.map((o, j) => (j === i ? merged : o));
      }
    }
  }
  return [...ops, op];
}

const iso = (at: number) => new Date(at).toISOString();

/** Une ligne de course de passage, pour l'afficher avant qu'elle parte (son vrai id viendra du serveur). */
const pendingId = (op: CourseOp, suffix: string | number) => `attente-${op.id}-${suffix}`;

/** La course est-elle déjà partie (envoi réussi juste avant une coupure) ? */
export function alreadyClosed(trips: readonly Trip[], plan: ClosePlan): Trip | null {
  return (
    trips.find(
      (t) => t.number === plan.trip.number && t.day === plan.trip.day && t.totalCents === plan.trip.totalCents && t.storeName === plan.trip.storeName,
    ) ?? null
  );
}

/**
 * Réapplique la file par-dessus les données venues du serveur (ou de la copie
 * gardée sur l'appareil) : l'écran montre ce que Jules a fait, même sans
 * réseau, et un rafraîchissement n'efface jamais ce qui n'est pas parti.
 * Ce que le serveur a déjà (un envoi réussi juste avant la coupure) n'est pas doublé.
 */
export function applyPending(server: CourseData, ops: readonly CourseOp[]): CourseData {
  if (ops.length === 0) return server;
  let { items, entries, stores, trips, tripItems } = server;
  items = items.slice();
  entries = entries.slice();
  stores = stores.slice();
  trips = trips.slice();
  tripItems = tripItems.slice();

  for (const op of ops) {
    switch (op.kind) {
      case 'createItem':
        if (!items.some((i) => i.id === op.itemId)) {
          items.push({
            id: op.itemId,
            name: op.input.name,
            aisle: op.input.aisle ?? 'autre',
            recurrence: op.input.recurrence ?? null,
            defaultQuantity: op.input.defaultQuantity ?? '',
            lastTripNumber: null,
            typology: op.input.typology ?? null,
            foodKind: op.input.foodKind ?? null,
            createdAt: iso(op.at),
          });
        }
        break;
      case 'updateItem':
        items = items.map((i) => (i.id === op.itemId ? { ...i, ...op.patch } : i));
        break;
      case 'deleteItem':
        items = items.filter((i) => i.id !== op.itemId);
        entries = entries.filter((e) => e.itemId !== op.itemId);
        break;
      case 'addEntry':
        if (!entries.some((e) => e.id === op.entryId)) {
          entries.push({ id: op.entryId, itemId: op.itemId, quantity: op.quantity, note: op.note, checked: false, priceCents: null, createdAt: iso(op.at) });
        }
        break;
      case 'updateEntry':
        entries = entries.map((e) => (e.id === op.entryId ? { ...e, ...op.patch } : e));
        break;
      case 'removeEntry':
        entries = entries.filter((e) => e.id !== op.entryId);
        break;
      case 'createStore':
        if (!stores.some((s) => s.id === op.storeId)) stores.push({ id: op.storeId, name: op.name, createdAt: iso(op.at) });
        break;
      case 'closeTrip': {
        const { plan } = op;
        if (alreadyClosed(trips, plan)) break;
        const tripId = pendingId(op, 'course');
        trips = [{ id: tripId, ...plan.trip, createdAt: iso(op.at) }, ...trips];
        tripItems = [...tripItems, ...plan.items.map((line, i) => ({ ...line, id: pendingId(op, i), tripId }))];
        const removed = new Set(plan.removeEntryIds);
        entries = entries.filter((e) => !removed.has(e.id));
        const purchased = new Set(plan.purchasedItemIds);
        items = items.map((i) => (purchased.has(i.id) ? { ...i, lastTripNumber: plan.trip.number } : i));
        for (const itemId of plan.addItemIds) {
          if (entries.some((e) => e.itemId === itemId)) continue;
          const item = items.find((i) => i.id === itemId);
          entries.push({ id: pendingId(op, itemId), itemId, quantity: item?.defaultQuantity ?? '', note: '', checked: false, priceCents: null, createdAt: iso(op.at) });
        }
        break;
      }
    }
  }
  return { items, entries, stores, trips, tripItems };
}

/** Une ligne affichée en attendant le serveur (habituel remis par une course terminée hors ligne). */
export const isPendingId = (id: string) => id.startsWith('attente-');
