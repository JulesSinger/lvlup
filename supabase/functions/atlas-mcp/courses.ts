/**
 * Les outils de Courses pour Claude (docs/connecteur-claude.md §8) — règles
 * pures, testées par Vitest (`src/modules/courses/lib/mcpTools.test.ts`), qui
 * compare aussi les règles recopiées ici (rayons, catalogue, récurrence,
 * dépense) à celles du module.
 *
 * Le cœur : **un ticket de caisse donné à Claude**. Claude lit la photo,
 * remet les abréviations au propre et appelle `courses_enregistrer_ticket` ;
 * la course est enregistrée comme « Terminer la course » dans l'app :
 * articles retrouvés dans le catalogue (ou créés), ceux de la liste cochés et
 * retirés, les habituels remis pour la suite, le magasin retrouvé (ou créé),
 * la dépense créée dans Budget (décisions de Jules, 11/10/2026). Le reste :
 * la liste, le catalogue, l'historique.
 *
 * Les outils passent par `CoursesData`, limité au compte du jeton
 * (`index.ts`). Colonnes : `2026-09-25-courses-tables.sql`.
 */
import type { Tool, ToolResult } from './mcp.ts';

// --- Les règles du module, recopiées (le test les compare) -----------------------------------

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

export const AISLE_KEYWORDS: [Aisle, string[]][] = [
  ['bebe', ['couche', 'lingette bebe', 'petit pot', 'lait infantile', 'biberon']],
  ['animaux', ['croquette', 'litiere', 'patee', 'chat', 'chien']],
  ['entretien', ['javel', 'lessive', 'liquide vaisselle', 'eponge', 'sac poubelle', 'essuie tout', 'papier toilette', 'nettoyant', 'adoucissant', 'pastille lave']],
  ['hygiene', ['shampoing', 'shampooing', 'gel douche', 'savon', 'dentifrice', 'brosse a dent', 'deodorant', 'coton', 'rasoir', 'mouchoir', 'serviette hygienique', 'tampon']],
  ['surgeles', ['surgele', 'glace', 'frite surgelee', 'pizza surgelee', 'poelee']],
  ['epicerie_salee', ['lait de coco', 'pate', 'riz', 'semoule', 'farine', 'huile', 'vinaigre', 'sel', 'poivre', 'epice', 'conserve', 'thon', 'sauce', 'moutarde', 'ketchup', 'mayonnaise', 'lentille', 'pois chiche', 'haricot', 'soupe', 'bouillon', 'chips', 'olive', 'quinoa']],
  ['epicerie_sucree', ['sucre', 'cafe', 'the', 'chocolat', 'confiture', 'miel', 'cereale', 'biscuit', 'gateau', 'compote', 'pate a tartiner', 'bonbon', 'muesli', 'flocon']],
  ['boissons', ['eau', 'jus', 'soda', 'coca', 'biere', 'vin', 'sirop', 'limonade']],
  ['boulangerie', ['pain', 'baguette', 'croissant', 'brioche', 'viennoiserie', 'pain de mie']],
  ['cremerie', ['lait', 'yaourt', 'yogourt', 'fromage', 'beurre', 'creme', 'oeuf', 'skyr', 'emmental', 'comte', 'mozzarella', 'camembert', 'fromage blanc']],
  ['boucherie_poissonnerie', ['poulet', 'boeuf', 'porc', 'veau', 'agneau', 'dinde', 'jambon', 'lardon', 'saucisse', 'steak', 'viande', 'poisson', 'saumon', 'cabillaud', 'crevette', 'charcuterie']],
  ['fruits_legumes', ['pomme', 'poire', 'banane', 'orange', 'citron', 'fraise', 'raisin', 'kiwi', 'tomate', 'salade', 'carotte', 'courgette', 'aubergine', 'poivron', 'oignon', 'ail', 'echalote', 'avocat', 'concombre', 'champignon', 'brocoli', 'epinard', 'legume', 'fruit', 'pomme de terre', 'patate', 'poireau', 'melon', 'peche']],
];

export const ITEM_NAME_MAX = 80;
/** La typologie d'un achat et, pour l'alimentation, sa sorte (docs/etude-courses-typologies.md) — comparées au module. */
export const TYPOLOGIES = ['alimentation', 'hygiene', 'entretien', 'maison', 'bebe', 'animaux', 'autre'] as const;
export const FOOD_KINDS = ['essentiel', 'plaisir', 'alcool'] as const;
export type Typology = (typeof TYPOLOGIES)[number];
export type FoodKind = (typeof FOOD_KINDS)[number];
export const STORE_NAME_MAX = 60;
export const QUANTITY_MAX = 30;
export const NOTE_MAX = 200;
export const RECURRENCE_MAX = 52;
export const CENTS_MAX = 10_000_000;
/** La catégorie demandée au budget, et la référence d'une course (`budgetLink.ts` du module). */
export const BUDGET_CATEGORY = 'Courses';
export const tripRef = (number: number) => `comete:course:${number}`;

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const singular = (text: string) =>
  normalize(text)
    .split(' ')
    .map((w) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w))
    .join(' ');

export function guessAisle(name: string): Aisle {
  const text = ` ${singular(name)} `;
  let best: { aisle: Aisle; length: number } | null = null;
  for (const [aisle, words] of AISLE_KEYWORDS) {
    for (const word of words) {
      if (text.includes(` ${word} `) && (!best || word.length > best.length)) best = { aisle, length: word.length };
    }
  }
  return best?.aisle ?? 'autre';
}

/** Le même article, à la casse, aux accents et au pluriel près. */
export function findItemLoosely<T extends { name: string }>(items: readonly T[], name: string): T | null {
  const exact = normalize(name);
  if (!exact) return null;
  return items.find((i) => normalize(i.name) === exact) ?? items.find((i) => singular(i.name) === singular(name)) ?? null;
}

export function isDue(item: { recurrence: number | null; last_trip_number: number | null }, tripNumber: number): boolean {
  if (item.recurrence === null) return false;
  if (item.last_trip_number === null) return true;
  return tripNumber - item.last_trip_number >= item.recurrence;
}

/** La dépense d'une course, comme `expenseForTrip` du module. */
export function expenseForTrip(trip: { number: number; day: string; store_name: string; total_cents: number }) {
  return {
    ref: tripRef(trip.number),
    day: trip.day,
    label: trip.store_name ? `Courses — ${trip.store_name}` : 'Courses',
    amountCents: trip.total_cents,
    categoryName: BUDGET_CATEGORY,
    note: `Courses, course n° ${trip.number}`,
  };
}

// --- Les données ------------------------------------------------------------------------------

export interface ItemRow {
  id: string;
  name: string;
  aisle: Aisle;
  recurrence: number | null;
  default_quantity: string;
  last_trip_number: number | null;
  typology?: Typology | null;
  food_kind?: FoodKind | null;
}
export interface StoreRow {
  id: string;
  name: string;
}
export interface EntryRow {
  id: string;
  item_id: string;
  quantity: string;
  note: string;
  checked: boolean;
  price_cents: number | null;
}
export interface TripRow {
  id: string;
  number: number;
  day: string;
  store_id: string | null;
  store_name: string;
  total_cents: number;
  note: string;
}
export interface TripItemRow {
  trip_id: string;
  item_id: string | null;
  name: string;
  aisle: string;
  quantity: string;
  price_cents: number | null;
}

export interface ExpenseRequest {
  ref: string;
  day: string;
  label: string;
  amountCents: number;
  categoryName: string;
  note: string;
}

/** Ce que les outils peuvent faire, toujours sur le seul compte du jeton. */
export interface CoursesData {
  listItems(): Promise<ItemRow[]>;
  listStores(): Promise<StoreRow[]>;
  listEntries(): Promise<EntryRow[]>;
  listTrips(): Promise<TripRow[]>;
  listTripItems(tripIds: string[]): Promise<TripItemRow[]>;
  insertItem(row: Record<string, unknown>): Promise<ItemRow>;
  updateItem(id: string, row: Record<string, unknown>): Promise<ItemRow | null>;
  insertEntry(row: Record<string, unknown>): Promise<EntryRow>;
  updateEntry(id: string, row: Record<string, unknown>): Promise<EntryRow | null>;
  deleteEntry(id: string): Promise<boolean>;
  /** Applique le plan d'un ticket d'un bloc (`courses_close_trip_for`). */
  closeTrip(plan: TicketPlan): Promise<TripRow>;
  deleteTrip(id: string): Promise<boolean>;
  /** La dépense dans Budget : rien si la référence y est déjà. */
  recordExpense(request: ExpenseRequest): Promise<void>;
  removeExpense(ref: string): Promise<void>;
  expenseRefs(refs: string[]): Promise<Set<string>>;
}

export interface CoursesContext {
  data: CoursesData;
  today: string;
  newId: () => string;
}

// --- Lire les arguments -----------------------------------------------------------------------

class Refused extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const json = (value: unknown): ToolResult => ({ text: JSON.stringify(value, null, 2) });

function id(v: unknown, what = 'identifiant'): string {
  if (typeof v !== 'string' || !UUID.test(v)) throw new Refused(`${what} invalide : prends-le dans le résultat d’un autre outil.`);
  return v.toLowerCase();
}

function text(v: unknown, what: string, max: number, required = false): string {
  if (v === undefined || v === null) {
    if (required) throw new Refused(`${what} manque.`);
    return '';
  }
  if (typeof v !== 'string') throw new Refused(`${what} doit être un texte.`);
  const t = v.trim().replace(/\s+/g, ' ');
  if (required && !t) throw new Refused(`${what} manque.`);
  if (t.length > max) throw new Refused(`${what} : ${max} caractères au plus.`);
  return t;
}

function realDay(v: unknown): string {
  if (typeof v !== 'string' || !DAY.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) {
    throw new Refused('Le jour s’écrit AAAA-MM-JJ (par exemple 2026-10-11).');
  }
  return v;
}

/** Des euros (1.89, ou « 1,89 ») → des centimes ; null si absent. */
export function euros(v: unknown, what: string): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(/\s|€/g, '').replace(',', '.')) : NaN;
  if (!Number.isFinite(n) || n < 0) throw new Refused(`${what} : un montant en euros, positif (1.89).`);
  const cents = Math.round(n * 100);
  if (cents > CENTS_MAX) throw new Refused(`${what} : montant trop grand.`);
  return cents;
}

function aisle(v: unknown): Aisle | null {
  if (v === undefined || v === null || v === '') return null;
  if (!(AISLES as readonly string[]).includes(String(v))) throw new Refused(`Rayon inconnu ; au choix : ${AISLES.join(', ')}.`);
  return v as Aisle;
}

function recurrence(v: unknown): number | null {
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > RECURRENCE_MAX) {
    throw new Refused(`recurrence : null (ponctuel) ou un nombre de courses de 1 à ${RECURRENCE_MAX}.`);
  }
  return v;
}

const recurrenceLabel = (r: number | null) => (r === null ? 'ponctuel' : r === 1 ? 'à chaque course' : `toutes les ${r} courses`);
const euro = (cents: number | null) => (cents === null ? null : Math.round(cents) / 100);

// --- Le ticket ---------------------------------------------------------------------------------

export interface TicketLine {
  name: string;
  quantity: string;
  priceCents: number | null;
  itemId: string | null;
  aisle: Aisle | null;
  /** Proposée par Claude ; appliquée à l'article du catalogue après la clôture */
  typology?: Typology | null;
  foodKind?: FoodKind | null;
}

export interface TicketPlan {
  newStore?: { id: string; name: string };
  newItems: { id: string; name: string; aisle: Aisle }[];
  trip: { number: number; day: string; storeId: string | null; storeName: string; totalCents: number; note: string };
  items: { itemId: string; name: string; aisle: Aisle; quantity: string; priceCents: number | null }[];
  purchasedItemIds: string[];
  removeEntryIds: string[];
  addItemIds: string[];
}

/**
 * Le plan d'un ticket, comme `buildClosePlan` du module, à trois différences
 * près : les lignes viennent du ticket et non des coches ; un article encore
 * inconnu entre au catalogue (ponctuel, rayon proposé par Claude ou deviné) ;
 * un magasin inconnu est créé. Toute ligne de la liste dont l'article est sur
 * le ticket compte comme achetée, cochée ou non ; le reste de la liste reste.
 */
export function ticketPlan(input: {
  items: readonly ItemRow[];
  stores: readonly StoreRow[];
  entries: readonly EntryRow[];
  trips: readonly Pick<TripRow, 'number'>[];
  day: string;
  storeName: string;
  totalCents: number | null;
  note: string;
  lines: readonly TicketLine[];
  newId: () => string;
}): { plan: TicketPlan; fromList: number; created: string[] } {
  if (input.lines.length === 0) throw new Refused('Le ticket n’a aucun article.');
  const number = input.trips.reduce((max, t) => Math.max(max, t.number), 0) + 1;
  // Le magasin au nom exact (casse et accents près), comme `findStoreByName` du module.
  const store = input.stores.find((s) => normalize(s.name) === normalize(input.storeName)) ?? null;
  const newStore = !store && input.storeName ? { id: input.newId(), name: input.storeName } : undefined;

  const known = [...input.items];
  const newItems: TicketPlan['newItems'] = [];
  const byId = new Map(input.items.map((i) => [i.id, i]));
  const items = input.lines.map((line) => {
    let item: { id: string; name: string; aisle: Aisle } | null = null;
    if (line.itemId) {
      item = byId.get(line.itemId) ?? null;
      if (!item) throw new Refused(`item_id inconnu pour « ${line.name} » : prends-le dans courses_catalogue, ou ne le donne pas.`);
    } else {
      item = findItemLoosely(known, line.name) ?? findItemLoosely(newItems, line.name);
    }
    if (!item) {
      item = { id: input.newId(), name: line.name, aisle: line.aisle ?? guessAisle(line.name) };
      newItems.push(item);
    }
    return { itemId: item.id, name: item.name, aisle: item.aisle, quantity: line.quantity, priceCents: line.priceCents };
  });

  const purchased = new Set(items.map((i) => i.itemId));
  const removed = input.entries.filter((e) => purchased.has(e.item_id));
  const remaining = new Set(input.entries.filter((e) => !purchased.has(e.item_id)).map((e) => e.item_id));
  const addItemIds = input.items
    .filter((item) => !remaining.has(item.id))
    .filter((item) => isDue({ ...item, last_trip_number: purchased.has(item.id) ? number : item.last_trip_number }, number + 1))
    .map((item) => item.id);

  const sum = items.reduce((s, i) => s + (i.priceCents ?? 0), 0);
  return {
    plan: {
      ...(newStore ? { newStore } : {}),
      newItems,
      trip: {
        number,
        day: input.day,
        storeId: store?.id ?? newStore?.id ?? null,
        storeName: store?.name ?? input.storeName,
        totalCents: input.totalCents ?? sum,
        note: input.note,
      },
      items,
      purchasedItemIds: [...purchased],
      removeEntryIds: removed.map((e) => e.id),
      addItemIds,
    },
    fromList: removed.length,
    created: newItems.map((i) => i.name),
  };
}

function ticketLines(v: unknown): TicketLine[] {
  if (!Array.isArray(v) || v.length === 0) throw new Refused('items : la liste des articles du ticket.');
  if (v.length > 300) throw new Refused('300 articles au plus par ticket.');
  return v.map((raw, i) => {
    if (typeof raw !== 'object' || raw === null) throw new Refused(`Article n° ${i + 1} : { name, price, quantity }.`);
    const o = raw as Record<string, unknown>;
    return {
      name: text(o.name, `Le nom de l’article n° ${i + 1}`, ITEM_NAME_MAX, true),
      quantity: text(o.quantity, `La quantité de l’article n° ${i + 1}`, QUANTITY_MAX),
      priceCents: euros(o.price, `Le prix de l’article n° ${i + 1}`),
      itemId: o.item_id === undefined || o.item_id === null ? null : id(o.item_id, `item_id de l’article n° ${i + 1}`),
      aisle: aisle(o.aisle),
      ...classification(o.typology, o.food_kind, `de l’article n° ${i + 1}`),
    };
  });
}

/** Une typologie et sa sorte, validées : la sorte ne vaut que pour l'alimentation (essentiel par défaut). */
export function classification(typology: unknown, foodKind: unknown, what: string): { typology?: Typology; foodKind?: FoodKind | null } {
  if (typology === undefined || typology === null) return {};
  if (!(TYPOLOGIES as readonly string[]).includes(String(typology))) throw new Refused(`La typologie ${what} : ${TYPOLOGIES.join(', ')}.`);
  const t = typology as Typology;
  if (t !== 'alimentation') return { typology: t, foodKind: null };
  if (foodKind !== undefined && foodKind !== null && !(FOOD_KINDS as readonly string[]).includes(String(foodKind))) {
    throw new Refused(`La sorte ${what} : ${FOOD_KINDS.join(', ')}.`);
  }
  return { typology: t, foodKind: (foodKind as FoodKind | undefined) ?? 'essentiel' };
}

const TYPOLOGY_HELP =
  'Typologie, pour le contenu des courses dans Budget : alimentation, hygiene (hygiène et beauté), entretien, maison (équipement), bebe, animaux, autre. Pour l’alimentation, food_kind : essentiel, plaisir (apéritif, sucreries, gâteaux), alcool.';

// --- Les outils --------------------------------------------------------------------------------

const S = {
  id: { type: 'string', description: 'Identifiant (uuid), tel que rendu par un autre outil.' },
  aisle: { type: 'string', enum: [...AISLES], description: 'Le rayon ; deviné d’après le nom s’il manque.' },
  price: { type: ['number', 'null'], minimum: 0, description: 'Prix payé pour la ligne, en euros (1.89), remises déduites.' },
};

export const coursesTools: Tool<CoursesContext>[] = [
  {
    name: 'courses_enregistrer_ticket',
    title: 'Enregistrer un ticket de caisse',
    description: [
      'Enregistre une course faite, à partir d’un ticket de caisse : comme « Terminer la course » dans l’app.',
      'Lis le ticket ligne à ligne et remets chaque article au propre, comme on l’écrirait sur une liste : « LAIT DEMI ECR 1L » → « Lait demi-écrémé », quantité « 1 L ».',
      'Donne aussi la typologie de chaque ligne quand tu la sais (typology, et food_kind pour l’alimentation) : « Allumettes fumées » sont des lardons (alimentation, essentiel), des chips de l’apéritif (plaisir).',
      'Avant, appelle courses_catalogue et reprends le nom (ou l’item_id) des articles déjà connus : l’historique des prix suit l’article.',
      'Prix de chaque ligne en euros, remises et bons de réduction déduits de l’article concerné ; une remise globale, déduis-la du total seulement. Ne compte pas les sacs ni les consignes comme articles si le ticket les distingue, mais garde-les dans le total.',
      'Le total est celui du ticket (ce qui a été payé). Effets : les articles de la liste de courses présents sur le ticket sont retirés de la liste ; les articles habituels reviennent quand c’est leur tour ; la dépense est créée dans Budget (catégorie Courses).',
      'Montre ensuite à l’utilisateur ce qui a été enregistré, en signalant les lignes douteuses.',
    ].join(' '),
    inputSchema: {
      type: 'object',
      properties: {
        store: { type: 'string', maxLength: STORE_NAME_MAX, description: 'Le magasin, nommé simplement : « Lidl », « Carrefour Market ».' },
        day: { type: 'string', description: 'Le jour du ticket, AAAA-MM-JJ.' },
        total: { type: 'number', minimum: 0, description: 'Le total payé, en euros.' },
        items: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', maxLength: ITEM_NAME_MAX, description: 'Le nom de l’article, au propre, sans marque si elle n’aide pas.' },
              quantity: { type: 'string', maxLength: QUANTITY_MAX, description: '« 2 », « 1 kg », « 6 × 1,5 L ».' },
              price: S.price,
              item_id: { type: 'string', description: 'L’article du catalogue, s’il est connu.' },
              aisle: S.aisle,
              typology: { type: 'string', enum: [...TYPOLOGIES], description: TYPOLOGY_HELP },
              food_kind: { type: 'string', enum: [...FOOD_KINDS] },
            },
            required: ['name'],
          },
        },
        note: { type: 'string', maxLength: NOTE_MAX },
        budget: { type: 'boolean', description: 'Créer la dépense dans Budget (oui par défaut).' },
      },
      required: ['store', 'day', 'total', 'items'],
    },
    annotations: {},
    async run(args, { data, newId }) {
      const day = realDay(args.day);
      const storeName = text(args.store, 'Le magasin', STORE_NAME_MAX, true);
      const totalCents = euros(args.total, 'Le total');
      if (totalCents === null) throw new Refused('Le total du ticket manque.');
      const lines = ticketLines(args.items);
      const note = text(args.note, 'La note', NOTE_MAX);
      const [items, stores, entries, trips] = await Promise.all([data.listItems(), data.listStores(), data.listEntries(), data.listTrips()]);
      const { plan, fromList, created } = ticketPlan({ items, stores, entries, trips, day, storeName, totalCents, note, lines, newId });
      const trip = await data.closeTrip(plan);

      // La typologie lue par Claude va à l'article du catalogue : toutes ses courses la suivent.
      // Un échec ici (migration pas encore appliquée) n'annule pas le ticket, déjà enregistré : il est dit.
      let classified = 0;
      let classifyError = '';
      for (const [i, line] of lines.entries()) {
        if (!line.typology) continue;
        try {
          if (await data.updateItem(plan.items[i].itemId, { typology: line.typology, food_kind: line.foodKind ?? null })) classified++;
        } catch (err) {
          classifyError = err instanceof Error ? err.message : 'erreur';
        }
      }

      let budget = 'non demandée';
      if (args.budget !== false) {
        try {
          await data.recordExpense(expenseForTrip(trip));
          budget = 'créée dans Budget';
        } catch (err) {
          budget = `pas créée (${err instanceof Error ? err.message : 'erreur'}) : « Ajouter au budget » dans l’historique de Courses`;
        }
      }
      const priced = lines.filter((l) => l.priceCents !== null);
      const sum = priced.reduce((s, l) => s + (l.priceCents ?? 0), 0);
      return json({
        message: `Course n° ${trip.number} enregistrée : ${trip.store_name}, ${trip.day}, ${lines.length} article${lines.length > 1 ? 's' : ''}, ${euro(trip.total_cents)} €.`,
        trip_id: trip.id,
        from_list: `${fromList} article${fromList > 1 ? 's' : ''} de la liste retiré${fromList > 1 ? 's' : ''}`,
        new_catalog_items: created,
        back_on_list: plan.addItemIds.length,
        classified: classified ? `${classified} article${classified > 1 ? 's' : ''} classé${classified > 1 ? 's' : ''}` : undefined,
        classify_error: classifyError ? `Typologies non enregistrées (${classifyError}) ; le ticket, lui, l’est.` : undefined,
        expense: budget,
        check: sum === trip.total_cents ? 'La somme des lignes égale le total.' : `La somme des lignes (${euro(sum)} €) diffère du total (${euro(trip.total_cents)} €) : remise globale, sac, ou ligne mal lue ?`,
      });
    },
  },
  {
    name: 'courses_liste',
    title: 'Lire la liste de courses',
    description: 'La liste de courses en cours, par rayon : pour chaque ligne, son id, l’article, la quantité, la note, si elle est cochée et son prix.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    async run(_args, { data }) {
      const [items, entries] = await Promise.all([data.listItems(), data.listEntries()]);
      const byId = new Map(items.map((i) => [i.id, i]));
      return json({
        count: entries.length,
        entries: entries
          .map((e) => ({ e, item: byId.get(e.item_id) }))
          .sort((a, b) => AISLES.indexOf(a.item?.aisle ?? 'autre') - AISLES.indexOf(b.item?.aisle ?? 'autre') || (a.item?.name ?? '').localeCompare(b.item?.name ?? '', 'fr'))
          .map(({ e, item }) => ({
            id: e.id,
            item_id: e.item_id,
            name: item?.name ?? '?',
            aisle: item?.aisle ?? 'autre',
            quantity: e.quantity,
            note: e.note,
            checked: e.checked,
            price: euro(e.price_cents),
          })),
      });
    },
  },
  {
    name: 'courses_liste_ajouter',
    title: 'Ajouter à la liste de courses',
    description:
      'Ajoute des articles à la liste. Un article déjà connu est repris (son rayon, sa récurrence) ; un nouveau entre au catalogue, ponctuel. Un article déjà sur la liste n’y est pas mis deux fois : sa quantité et sa note sont mises à jour.',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', maxLength: ITEM_NAME_MAX },
              quantity: { type: 'string', maxLength: QUANTITY_MAX },
              note: { type: 'string', maxLength: NOTE_MAX },
              aisle: S.aisle,
            },
            required: ['name'],
          },
        },
      },
      required: ['items'],
    },
    annotations: {},
    async run(args, { data }) {
      if (!Array.isArray(args.items) || args.items.length === 0) throw new Refused('items : la liste des articles à ajouter.');
      if (args.items.length > 200) throw new Refused('200 articles au plus à la fois.');
      const wanted = args.items.map((raw, i) => {
        const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
        return {
          name: text(o.name, `Le nom de l’article n° ${i + 1}`, ITEM_NAME_MAX, true),
          quantity: text(o.quantity, 'La quantité', QUANTITY_MAX),
          note: text(o.note, 'La note', NOTE_MAX),
          aisle: aisle(o.aisle),
        };
      });
      const [items, entries] = await Promise.all([data.listItems(), data.listEntries()]);
      const done: string[] = [];
      for (const w of wanted) {
        const found = findItemLoosely(items, w.name);
        const item = found ?? (await data.insertItem({ name: w.name, aisle: w.aisle ?? guessAisle(w.name) }));
        if (!found) items.push(item);
        const entry = entries.find((e) => e.item_id === item.id);
        if (entry) {
          const patch: Record<string, unknown> = { checked: false };
          if (w.quantity) patch.quantity = w.quantity;
          if (w.note) patch.note = w.note;
          await data.updateEntry(entry.id, patch);
          done.push(`${item.name} (déjà sur la liste, mis à jour)`);
        } else {
          entries.push(await data.insertEntry({ item_id: item.id, quantity: w.quantity || item.default_quantity, note: w.note }));
          done.push(item.name);
        }
      }
      return json({ message: `${done.length} article${done.length > 1 ? 's' : ''} sur la liste.`, items: done });
    },
  },
  {
    name: 'courses_liste_modifier',
    title: 'Modifier une ligne de la liste',
    description: 'Change la quantité, la note, la coche ou le prix (en euros) d’une ligne de la liste (son id est dans courses_liste).',
    inputSchema: {
      type: 'object',
      properties: {
        id: S.id,
        quantity: { type: 'string', maxLength: QUANTITY_MAX },
        note: { type: 'string', maxLength: NOTE_MAX },
        checked: { type: 'boolean' },
        price: S.price,
      },
      required: ['id'],
    },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      const entryId = id(args.id);
      const row: Record<string, unknown> = {};
      if (args.quantity !== undefined) row.quantity = text(args.quantity, 'La quantité', QUANTITY_MAX);
      if (args.note !== undefined) row.note = text(args.note, 'La note', NOTE_MAX);
      if (args.checked !== undefined) {
        if (typeof args.checked !== 'boolean') throw new Refused('checked : vrai ou faux.');
        row.checked = args.checked;
      }
      if (args.price !== undefined) row.price_cents = euros(args.price, 'Le prix');
      if (Object.keys(row).length === 0) throw new Refused('Rien à modifier : donne au moins un champ.');
      const updated = await data.updateEntry(entryId, row);
      if (!updated) throw new Refused('Aucune ligne de la liste avec cet identifiant : relis la liste.');
      return json({ message: 'Ligne modifiée.', entry: { ...updated, price: euro(updated.price_cents) } });
    },
  },
  {
    name: 'courses_liste_retirer',
    title: 'Retirer de la liste',
    description: 'Retire des lignes de la liste, sans les compter comme achetées (l’article reste au catalogue).',
    inputSchema: { type: 'object', properties: { ids: { type: 'array', items: S.id, minItems: 1 } }, required: ['ids'] },
    annotations: { destructiveHint: true },
    async run(args, { data }) {
      if (!Array.isArray(args.ids) || args.ids.length === 0) throw new Refused('ids : les lignes à retirer.');
      let gone = 0;
      for (const raw of args.ids) if (await data.deleteEntry(id(raw))) gone++;
      return { text: `${gone} ligne${gone > 1 ? 's' : ''} retirée${gone > 1 ? 's' : ''} de la liste.` };
    },
  },
  {
    name: 'courses_catalogue',
    title: 'Lire le catalogue et les magasins',
    description:
      'Les articles connus (id, nom, rayon, récurrence, quantité habituelle, sur la liste ou non, dernier prix) et les magasins. À lire avant d’enregistrer un ticket, pour reprendre les noms existants. « query » filtre les articles.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
    annotations: { readOnlyHint: true },
    async run(args, { data }) {
      const query = normalize(text(args.query, 'query', 80));
      const [items, stores, entries, trips] = await Promise.all([data.listItems(), data.listStores(), data.listEntries(), data.listTrips()]);
      const recent = [...trips].sort((a, b) => b.number - a.number).slice(0, 30);
      const tripItems = await data.listTripItems(recent.map((t) => t.id));
      const order = new Map(recent.map((t) => [t.id, t.number]));
      const last = new Map<string, number>();
      for (const ti of [...tripItems].sort((a, b) => (order.get(a.trip_id) ?? 0) - (order.get(b.trip_id) ?? 0))) {
        if (ti.item_id && ti.price_cents !== null) last.set(ti.item_id, ti.price_cents);
      }
      const onList = new Set(entries.map((e) => e.item_id));
      return json({
        stores: stores.map((s) => s.name),
        items: items
          .filter((i) => !query || query.split(' ').every((w) => normalize(i.name).includes(w)))
          .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
          .map((i) => ({
            id: i.id,
            name: i.name,
            aisle: i.aisle,
            typology: i.typology ? (i.food_kind ? `${i.typology}:${i.food_kind}` : i.typology) : undefined,
            recurrence: recurrenceLabel(i.recurrence),
            default_quantity: i.default_quantity,
            on_list: onList.has(i.id),
            last_price: euro(last.get(i.id) ?? null),
          })),
      });
    },
  },
  {
    name: 'courses_article_modifier',
    title: 'Modifier un article du catalogue',
    description:
      'Renomme un article, change son rayon, sa quantité habituelle, sa récurrence (null pour un article ponctuel, 1 pour « à chaque course », N pour « toutes les N courses ») ou sa typologie dans les dépenses.',
    inputSchema: {
      type: 'object',
      properties: {
        id: S.id,
        name: { type: 'string', maxLength: ITEM_NAME_MAX },
        aisle: S.aisle,
        default_quantity: { type: 'string', maxLength: QUANTITY_MAX },
        recurrence: { type: ['integer', 'null'], minimum: 1, maximum: RECURRENCE_MAX },
        typology: { type: ['string', 'null'], enum: [...TYPOLOGIES, null], description: `${TYPOLOGY_HELP} null : la deviner d’après le nom. Ses courses passées suivent.` },
        food_kind: { type: 'string', enum: [...FOOD_KINDS] },
      },
      required: ['id'],
    },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      const itemId = id(args.id);
      const row: Record<string, unknown> = {};
      if (args.name !== undefined) {
        const name = text(args.name, 'Le nom', ITEM_NAME_MAX, true);
        const twin = findItemLoosely((await data.listItems()).filter((i) => i.id !== itemId), name);
        if (twin && normalize(twin.name) === normalize(name)) throw new Refused(`Un autre article s’appelle déjà « ${twin.name} ».`);
        row.name = name;
      }
      if (args.aisle !== undefined) row.aisle = aisle(args.aisle) ?? 'autre';
      if (args.default_quantity !== undefined) row.default_quantity = text(args.default_quantity, 'La quantité habituelle', QUANTITY_MAX);
      if (args.recurrence !== undefined) row.recurrence = recurrence(args.recurrence);
      if (args.typology !== undefined) {
        const c = classification(args.typology, args.food_kind, 'de l’article');
        row.typology = c.typology ?? null;
        row.food_kind = c.foodKind ?? null;
      }
      if (Object.keys(row).length === 0) throw new Refused('Rien à modifier : donne au moins un champ.');
      const updated = await data.updateItem(itemId, row);
      if (!updated) throw new Refused('Aucun article avec cet identifiant : relis le catalogue.');
      return json({ message: `Article « ${updated.name} » modifié (${recurrenceLabel(updated.recurrence)}).`, item: updated });
    },
  },
  {
    name: 'courses_historique',
    title: 'Lire l’historique des courses',
    description: 'Les dernières courses (10 par défaut), ou celles d’une période : jour, magasin, total, articles et leurs prix, et si la dépense est dans Budget.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 100 },
        from: { type: 'string', description: 'AAAA-MM-JJ' },
        to: { type: 'string', description: 'AAAA-MM-JJ' },
      },
    },
    annotations: { readOnlyHint: true },
    async run(args, { data }) {
      const from = args.from === undefined ? null : realDay(args.from);
      const to = args.to === undefined ? null : realDay(args.to);
      const limit = typeof args.limit === 'number' && Number.isInteger(args.limit) ? Math.min(100, Math.max(1, args.limit)) : 10;
      const trips = (await data.listTrips())
        .filter((t) => (!from || t.day >= from) && (!to || t.day <= to))
        .sort((a, b) => b.day.localeCompare(a.day) || b.number - a.number)
        .slice(0, limit);
      const [tripItems, inBudget] = await Promise.all([data.listTripItems(trips.map((t) => t.id)), data.expenseRefs(trips.map((t) => tripRef(t.number)))]);
      return json({
        trips: trips.map((t) => ({
          id: t.id,
          number: t.number,
          day: t.day,
          store: t.store_name,
          total: euro(t.total_cents),
          note: t.note,
          in_budget: inBudget.has(tripRef(t.number)),
          items: tripItems.filter((ti) => ti.trip_id === t.id).map((ti) => ({ name: ti.name, quantity: ti.quantity, price: euro(ti.price_cents) })),
        })),
      });
    },
  },
  {
    name: 'courses_supprimer_course',
    title: 'Supprimer une course',
    description:
      'Supprime une course enregistrée par erreur, et sa dépense dans Budget. La liste et la récurrence ne sont pas rejouées (comme dans l’app). Demande confirmation avant.',
    inputSchema: { type: 'object', properties: { id: S.id }, required: ['id'] },
    annotations: { destructiveHint: true },
    async run(args, { data }) {
      const tripId = id(args.id);
      const trip = (await data.listTrips()).find((t) => t.id === tripId);
      if (!trip) throw new Refused('Aucune course avec cet identifiant : relis l’historique.');
      // La dépense d'abord : jamais de dépense orpheline d'une course disparue.
      await data.removeExpense(tripRef(trip.number));
      await data.deleteTrip(trip.id);
      return { text: `Course n° ${trip.number} (${trip.store_name}, ${trip.day}) supprimée, avec sa dépense.` };
    },
  },
];
