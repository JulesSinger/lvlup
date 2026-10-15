import { describe, expect, it } from 'vitest';
import * as server from '../../../../supabase/functions/atlas-mcp/courses.ts';
import { coursesTools, ticketPlan, type CoursesData, type EntryRow, type ItemRow, type TicketPlan, type TripRow } from '../../../../supabase/functions/atlas-mcp/courses.ts';
import { AISLE_KEYWORDS, guessAisle } from './aisles';
import { BUDGET_CATEGORY, expenseForTrip, tripRef } from './budgetLink';
import { findItemLoosely } from './catalog';
import { buildClosePlan, isDue } from './trip';
import { FOOD_KINDS, TYPOLOGIES } from './typology';
import { AISLES, type Item, type ListEntry } from './types';

const NAMES = ['Tomates cerises', 'lait de coco', 'Eau de Javel', 'Thé vert', 'Thon', 'Pommes de terre', 'Œufs', 'Croquettes chat', 'Yaourts nature', 'Bière', 'xyz'];

describe('les règles de Courses recopiées dans le connecteur', () => {
  it('sont celles du module', () => {
    expect(server.AISLES).toEqual(AISLES);
    expect(server.AISLE_KEYWORDS).toEqual(AISLE_KEYWORDS);
    for (const name of NAMES) expect(server.guessAisle(name)).toBe(guessAisle(name));
    const catalog = [{ id: '1', name: 'Oignon jaune' }, { id: '2', name: 'Œufs' }, { id: '3', name: 'Lait' }] as Item[];
    for (const name of ['oignons jaunes', 'OEUFS', 'œuf', 'lait', 'laits', 'Lait de coco']) {
      expect(server.findItemLoosely(catalog, name)?.id ?? null).toBe(findItemLoosely(catalog, name)?.id ?? null);
    }
    for (const [recurrence, last, n] of [[null, null, 3], [1, null, 3], [1, 2, 3], [3, 2, 4], [3, 2, 5]] as const) {
      expect(server.isDue({ recurrence, last_trip_number: last }, n)).toBe(isDue({ recurrence, lastTripNumber: last }, n));
    }
    expect(server.BUDGET_CATEGORY).toBe(BUDGET_CATEGORY);
    const trip = { number: 12, day: '2026-10-11', storeName: 'Lidl', totalCents: 5420 };
    expect(server.tripRef(12)).toBe(tripRef(trip));
    const fromServer = server.expenseForTrip({ number: 12, day: '2026-10-11', store_name: 'Lidl', total_cents: 5420 });
    expect(fromServer).toEqual({ ...expenseForTrip(trip), note: expenseForTrip(trip).note ?? '' });
  });

  it('un ticket donne le même plan que « Terminer la course » avec les mêmes articles cochés', () => {
    const items: ItemRow[] = [
      { id: 'lait', name: 'Lait', aisle: 'cremerie', recurrence: 1, default_quantity: '2', last_trip_number: 3 },
      { id: 'lessive', name: 'Lessive', aisle: 'entretien', recurrence: 3, default_quantity: '', last_trip_number: 2 },
      { id: 'pain', name: 'Pain', aisle: 'boulangerie', recurrence: null, default_quantity: '', last_trip_number: null },
      { id: 'tomate', name: 'Tomates', aisle: 'fruits_legumes', recurrence: null, default_quantity: '', last_trip_number: null },
    ];
    const entries: EntryRow[] = [
      { id: 'e-lait', item_id: 'lait', quantity: '2', note: '', checked: false, price_cents: null },
      { id: 'e-pain', item_id: 'pain', quantity: '', note: '', checked: true, price_cents: null },
      { id: 'e-tomate', item_id: 'tomate', quantity: '', note: '', checked: false, price_cents: null },
    ];
    const trips = [{ number: 1 }, { number: 2 }, { number: 3 }];
    const { plan, fromList } = ticketPlan({
      items,
      stores: [{ id: 's1', name: 'Lidl' }],
      entries,
      trips,
      day: '2026-10-11',
      storeName: 'LIDL',
      totalCents: 512,
      note: '',
      lines: [
        { name: 'lait', quantity: '1 L', priceCents: 112, itemId: null, aisle: null },
        { name: 'Pain', quantity: '', priceCents: 150, itemId: null, aisle: null },
      ],
      newId: () => 'x',
    });
    const app = buildClosePlan({
      items: items.map((i) => ({ id: i.id, name: i.name, aisle: i.aisle, recurrence: i.recurrence, defaultQuantity: i.default_quantity, lastTripNumber: i.last_trip_number, createdAt: '' })),
      entries: entries.map((e) => ({ id: e.id, itemId: e.item_id, quantity: e.quantity, note: e.note, checked: e.item_id !== 'tomate', priceCents: null, createdAt: '' })) as ListEntry[],
      trips,
      day: '2026-10-11',
      store: { id: 's1', name: 'Lidl' },
      totalCents: 512,
    });
    expect(fromList).toBe(2);
    expect(plan.trip).toEqual(app.trip);
    expect(plan.removeEntryIds.sort()).toEqual(app.removeEntryIds.sort());
    expect(plan.purchasedItemIds.sort()).toEqual(app.purchasedItemIds.sort());
    // Le lait (à chaque course) et la lessive (toutes les 3, achetée à la 2) reviennent ; les tomates restent sur la liste.
    expect(plan.addItemIds.sort()).toEqual(app.addItemIds.sort());
    expect(plan.addItemIds.sort()).toEqual(['lait', 'lessive']);
    expect(plan.newItems).toEqual([]);
    expect(plan.newStore).toBeUndefined();
  });
});

/** Une base en mémoire, du seul compte du jeton. */
function memory() {
  let n = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++n + 500).padStart(12, '0')}`;
  const db = {
    items: [] as ItemRow[],
    stores: [{ id: 's-lidl', name: 'Lidl' }],
    entries: [] as EntryRow[],
    trips: [] as TripRow[],
    tripItems: [] as { trip_id: string; item_id: string | null; name: string; aisle: string; quantity: string; price_cents: number | null }[],
    expenses: [] as { ref: string; amountCents: number; label: string }[],
    plans: [] as TicketPlan[],
  };
  const data: CoursesData = {
    listItems: async () => [...db.items],
    listStores: async () => db.stores,
    listEntries: async () => [...db.entries],
    listTrips: async () => db.trips,
    listTripItems: async (ids) => db.tripItems.filter((t) => ids.includes(t.trip_id)),
    insertItem: async (row) => {
      const item = { id: uuid(), recurrence: null, default_quantity: '', last_trip_number: null, ...row } as ItemRow;
      db.items.push(item);
      return item;
    },
    updateItem: async (id, row) => {
      const item = db.items.find((i) => i.id === id);
      return item ? Object.assign(item, row) : null;
    },
    insertEntry: async (row) => {
      const entry = { id: uuid(), note: '', checked: false, price_cents: null, quantity: '', ...row } as EntryRow;
      db.entries.push(entry);
      return entry;
    },
    updateEntry: async (id, row) => {
      const entry = db.entries.find((e) => e.id === id);
      return entry ? Object.assign(entry, row) : null;
    },
    deleteEntry: async (id) => {
      const before = db.entries.length;
      db.entries = db.entries.filter((e) => e.id !== id);
      return db.entries.length < before;
    },
    closeTrip: async (plan) => {
      db.plans.push(plan);
      if (plan.newStore) db.stores.push(plan.newStore);
      for (const item of plan.newItems) db.items.push({ ...item, recurrence: null, default_quantity: '', last_trip_number: null });
      const trip: TripRow = {
        id: `00000000-0000-4000-9000-${String(plan.trip.number).padStart(12, '0')}`,
        number: plan.trip.number,
        day: plan.trip.day,
        store_id: plan.trip.storeId,
        store_name: plan.trip.storeName,
        total_cents: plan.trip.totalCents,
        note: plan.trip.note,
      };
      db.trips.push(trip);
      for (const i of plan.items) db.tripItems.push({ trip_id: trip.id, item_id: i.itemId, name: i.name, aisle: i.aisle, quantity: i.quantity, price_cents: i.priceCents });
      db.entries = db.entries.filter((e) => !plan.removeEntryIds.includes(e.id));
      return trip;
    },
    deleteTrip: async (id) => {
      db.trips = db.trips.filter((t) => t.id !== id);
      return true;
    },
    recordExpense: async (request) => {
      if (!db.expenses.some((e) => e.ref === request.ref)) db.expenses.push(request);
    },
    removeExpense: async (ref) => {
      db.expenses = db.expenses.filter((e) => e.ref !== ref);
    },
    expenseRefs: async (refs) => new Set(db.expenses.filter((e) => refs.includes(e.ref)).map((e) => e.ref)),
  };
  return { db, data };
}

async function use(data: CoursesData, name: string, args: Record<string, unknown> = {}) {
  const tool = coursesTools.find((t) => t.name === name);
  if (!tool) throw new Error(`outil ${name}`);
  let k = 0;
  try {
    const result = await tool.run(args, { data, today: '2026-10-11', newId: () => `00000000-0000-4000-8000-${String(++k).padStart(12, '0')}` });
    let value = null;
    try {
      value = JSON.parse(result.text);
    } catch {
      // un simple texte
    }
    return { error: false, text: result.text, value };
  } catch (err) {
    return { error: true, text: (err as Error).message, value: null };
  }
}

describe('les outils de Courses pour Claude', () => {
  it('enregistrent un ticket : la course, la liste cochée, le catalogue, la dépense', async () => {
    const { db, data } = memory();
    await use(data, 'courses_liste_ajouter', { items: [{ name: 'Lait', quantity: '2' }, { name: 'Tomates' }] });
    expect(db.entries).toHaveLength(2);
    const lait = db.items.find((i) => i.name === 'Lait')!;

    const result = await use(data, 'courses_enregistrer_ticket', {
      store: 'lidl',
      day: '2026-10-11',
      total: 7.38,
      items: [
        { name: 'lait', quantity: '1 L', price: 1.12, item_id: lait.id },
        { name: 'Yaourts nature', quantity: '4 × 125 g', price: '1,89' },
        { name: 'Liquide vaisselle', price: 2.5, aisle: 'entretien' },
      ],
    });
    expect(result.error).toBe(false);
    expect(result.value).toMatchObject({ new_catalog_items: ['Yaourts nature', 'Liquide vaisselle'], expense: 'créée dans Budget' });
    expect(result.value.check).toMatch(/diffère du total/); // 5,51 € de lignes pour 7,38 € payés
    expect(db.trips[0]).toMatchObject({ number: 1, store_name: 'Lidl', store_id: 's-lidl', total_cents: 738 });
    expect(db.items.find((i) => i.name === 'Yaourts nature')?.aisle).toBe('cremerie');
    // Le lait était sur la liste : il en sort ; les tomates restent.
    expect(db.entries.map((e) => db.items.find((i) => i.id === e.item_id)?.name)).toEqual(['Tomates']);
    expect(db.expenses).toEqual([{ ref: 'comete:course:1', day: '2026-10-11', label: 'Courses — Lidl', amountCents: 738, categoryName: 'Courses', note: 'Courses, course n° 1' }]);

    // Un nouveau magasin, sans Budget.
    await use(data, 'courses_enregistrer_ticket', { store: 'Marché', day: '2026-10-12', total: 3, items: [{ name: 'Yaourt nature', price: 3 }], budget: false });
    expect(db.stores.map((s) => s.name)).toEqual(['Lidl', 'Marché']);
    expect(db.plans[1].newItems).toEqual([]); // « Yaourt nature » retrouve « Yaourts nature »
    expect(db.expenses).toHaveLength(1);

    const history = (await use(data, 'courses_historique')).value.trips;
    expect(history.map((t: { number: number; in_budget: boolean }) => [t.number, t.in_budget])).toEqual([
      [2, false],
      [1, true],
    ]);
    expect(history[1].items[1]).toEqual({ name: 'Yaourts nature', quantity: '4 × 125 g', price: 1.89 });

    // Supprimer une course retire sa dépense.
    await use(data, 'courses_supprimer_course', { id: db.trips[0].id });
    expect(db.trips.map((t) => t.number)).toEqual([2]);
    expect(db.expenses).toEqual([]);
  });

  it('refusent un ticket incomplet, sans rien écrire', async () => {
    const { db, data } = memory();
    expect((await use(data, 'courses_enregistrer_ticket', { store: 'Lidl', day: '11/10/2026', total: 3, items: [{ name: 'Pain' }] })).text).toMatch(/AAAA-MM-JJ/);
    expect((await use(data, 'courses_enregistrer_ticket', { store: 'Lidl', day: '2026-10-11', items: [{ name: 'Pain' }] })).text).toMatch(/total/);
    expect((await use(data, 'courses_enregistrer_ticket', { store: 'Lidl', day: '2026-10-11', total: 3, items: [] })).text).toMatch(/articles du ticket/);
    expect((await use(data, 'courses_enregistrer_ticket', { store: 'Lidl', day: '2026-10-11', total: -1, items: [{ name: 'Pain' }] })).text).toMatch(/positif/);
    expect(
      (await use(data, 'courses_enregistrer_ticket', { store: 'Lidl', day: '2026-10-11', total: 1, items: [{ name: 'Pain', item_id: '00000000-0000-4000-8000-000000000099' }] })).text,
    ).toMatch(/item_id inconnu/);
    expect(db.trips).toHaveLength(0);
  });

  it('tiennent la liste et le catalogue', async () => {
    const { db, data } = memory();
    await use(data, 'courses_liste_ajouter', { items: [{ name: 'Œufs', quantity: '6' }] });
    await use(data, 'courses_liste_ajouter', { items: [{ name: 'oeufs', quantity: '12', note: 'bio' }] });
    expect(db.entries).toHaveLength(1);
    expect(db.entries[0]).toMatchObject({ quantity: '12', note: 'bio' });
    const list = (await use(data, 'courses_liste')).value;
    expect(list.entries[0]).toMatchObject({ name: 'Œufs', aisle: 'cremerie', quantity: '12', checked: false });
    await use(data, 'courses_liste_modifier', { id: db.entries[0].id, checked: true, price: 3.2 });
    expect(db.entries[0]).toMatchObject({ checked: true, price_cents: 320 });
    const egg = db.items[0];
    expect((await use(data, 'courses_article_modifier', { id: egg.id, recurrence: 2, default_quantity: '12' })).text).toMatch(/toutes les 2 courses/);
    expect((await use(data, 'courses_article_modifier', { id: egg.id, recurrence: 0 })).text).toMatch(/null \(ponctuel\)/);
    expect((await use(data, 'courses_catalogue', { query: 'oeuf' })).value.items).toMatchObject([{ name: 'Œufs', recurrence: 'toutes les 2 courses', on_list: true }]);
    await use(data, 'courses_liste_retirer', { ids: [db.entries[0].id] });
    expect(db.entries).toHaveLength(0);
    expect(db.items).toHaveLength(1);
  });

  it('disent à Claude ce qui détruit', () => {
    const hints = Object.fromEntries(coursesTools.map((t) => [t.name, t.annotations]));
    expect(hints.courses_supprimer_course.destructiveHint).toBe(true);
    expect(hints.courses_liste.readOnlyHint).toBe(true);
    expect(coursesTools.every((t) => t.name.startsWith('courses_'))).toBe(true);
  });

  it('classent les articles d’un ticket, et un article à la main (docs/etude-courses-typologies.md)', async () => {
    expect(server.TYPOLOGIES).toEqual(TYPOLOGIES);
    expect(server.FOOD_KINDS).toEqual(FOOD_KINDS);
    const { db, data } = memory();
    const result = await use(data, 'courses_enregistrer_ticket', {
      store: 'Auchan',
      day: '2026-10-10',
      total: 4.5,
      items: [
        { name: 'Allumettes fumées', price: 1.85, typology: 'alimentation', food_kind: 'essentiel' },
        { name: 'Chips barbecue', price: 1.82, typology: 'alimentation', food_kind: 'plaisir' },
        { name: 'Ampoule', price: 0.83, typology: 'maison', food_kind: 'plaisir' },
      ],
      budget: false,
    });
    expect(result.value.classified).toBe('3 articles classés');
    expect(db.items.find((i) => i.name === 'Chips barbecue')).toMatchObject({ typology: 'alimentation', food_kind: 'plaisir' });
    expect(db.items.find((i) => i.name === 'Ampoule')).toMatchObject({ typology: 'maison', food_kind: null });
    const ampoule = db.items.find((i) => i.name === 'Ampoule')!;
    await use(data, 'courses_article_modifier', { id: ampoule.id, typology: 'entretien' });
    expect(ampoule).toMatchObject({ typology: 'entretien', food_kind: null });
    expect((await use(data, 'courses_article_modifier', { id: ampoule.id, typology: 'jardin' })).text).toMatch(/typologie/);
  });
});
