/**
 * Types du module courses (Comète). Conception complète : docs/etude-courses.md.
 *
 * Montants en centimes entiers (`…Cents`), comme Astra : jamais de flottant
 * qu'une addition ferait dériver.
 */

/**
 * Les rayons, dans l'ordre d'un parcours de magasin type. Le pendant des
 * contraintes `courses_items_aisle_check` et `courses_trip_items_aisle_check` :
 * `lib/schema.test.ts` compare les trois, même discipline que `TIER_KINDS`
 * (CLAUDE.md §5).
 */
export const AISLES = [
  'fruits_legumes',
  'boulangerie',
  'cremerie',
  'boucherie_poissonnerie',
  'epicerie_salee',
  'epicerie_sucree',
  'surgeles',
  'boissons',
  'hygiene',
  'entretien',
  'bebe',
  'animaux',
  'autre',
] as const;
export type Aisle = (typeof AISLES)[number];

export const AISLE_LABELS: Record<Aisle, string> = {
  fruits_legumes: 'Fruits et légumes',
  boulangerie: 'Boulangerie',
  cremerie: 'Crèmerie',
  boucherie_poissonnerie: 'Boucherie, poissonnerie',
  epicerie_salee: 'Épicerie salée',
  epicerie_sucree: 'Épicerie sucrée',
  surgeles: 'Surgelés',
  boissons: 'Boissons',
  hygiene: 'Hygiène',
  entretien: 'Entretien',
  bebe: 'Bébé',
  animaux: 'Animaux',
  autre: 'Autre',
};

/**
 * Un article du catalogue.
 *
 * `recurrence` : `null` = ponctuel ; N = revient toutes les N courses
 * (1 = à chaque course). Décision du 25/09/2026, étude §12.
 */
export interface Item {
  id: string;
  name: string;
  aisle: Aisle;
  recurrence: number | null;
  /** Quantité proposée quand l'article revient sur la liste (« 2 », « 1 kg ») */
  defaultQuantity: string;
  /** Numéro de la dernière course où il a été acheté — l'horloge de la récurrence */
  lastTripNumber: number | null;
  createdAt: string;
}

export type ItemInput = Pick<Item, 'name'> & Partial<Pick<Item, 'aisle' | 'recurrence' | 'defaultQuantity'>>;

export interface Store {
  id: string;
  name: string;
  createdAt: string;
}

/** Une ligne de la liste en cours. */
export interface ListEntry {
  id: string;
  itemId: string;
  quantity: string;
  note: string;
  checked: boolean;
  /** Prix payé pour cette ligne, saisi en magasin ou au retour ; facultatif */
  priceCents: number | null;
  createdAt: string;
}

export type ListEntryPatch = Partial<Pick<ListEntry, 'quantity' | 'note' | 'checked' | 'priceCents'>>;

/**
 * Une course faite. `storeName` est figé, comme ce qui a été acheté :
 * renommer ou supprimer un magasin ne réécrit pas l'historique.
 */
export interface Trip {
  id: string;
  /** 1, 2, 3… dans l'ordre des courses du compte */
  number: number;
  day: string;
  storeId: string | null;
  storeName: string;
  /** Le total du ticket, qui fait foi (étude §12) */
  totalCents: number;
  note: string;
  createdAt: string;
}

/** Ce qui a été acheté à une course : nom, rayon, quantité et prix figés. */
export interface TripItem {
  id: string;
  tripId: string;
  itemId: string | null;
  name: string;
  aisle: Aisle;
  quantity: string;
  priceCents: number | null;
}

export type TripItemInput = Omit<TripItem, 'id' | 'tripId'>;

/**
 * Tout ce que « terminer la course » écrit, calculé d'avance par
 * `lib/trip.ts` (étape 2) et appliqué d'un bloc par le stockage — en une
 * transaction côté Supabase (`courses_close_trip`). Le contrat de stockage
 * ne connaît pas la règle de récurrence, il applique le plan.
 */
export interface ClosePlan {
  trip: Pick<Trip, 'number' | 'day' | 'storeId' | 'storeName' | 'totalCents' | 'note'>;
  items: TripItemInput[];
  /** Articles achetés : leur `lastTripNumber` devient le numéro de la course */
  purchasedItemIds: string[];
  /** Lignes de la liste à retirer (les cochées) */
  removeEntryIds: string[];
  /** Articles habituels à remettre sur la liste pour la course suivante */
  addItemIds: string[];
}
