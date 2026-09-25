import { beforeEach, describe, expect, it } from 'vitest';
import type { ClosePlan } from '../lib/types';
import { LocalCourses } from './localCourses';

/**
 * Le module s'appuie sur localStorage ; en environnement Node on en fournit
 * une version minimale plutôt que de tirer tout un DOM — même motif que
 * `modules/nutrition/data/localNutrition.test.ts`.
 */
const memory = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
} as Storage;

describe('LocalCourses', () => {
  let store: LocalCourses;

  beforeEach(() => {
    memory.clear();
    store = new LocalCourses();
  });

  it('crée un article ponctuel par défaut, rayon « autre »', async () => {
    const item = await store.createItem({ name: 'Piles' });
    expect(item).toMatchObject({ aisle: 'autre', recurrence: null, defaultQuantity: '', lastTripNumber: null });
  });

  it('ajoute, coche et prixe une ligne de la liste', async () => {
    const lait = await store.createItem({ name: 'Lait', aisle: 'cremerie', recurrence: 1 });
    const entry = await store.addEntry(lait.id, '2');
    await store.updateEntry(entry.id, { checked: true, priceCents: 238 });
    expect(await store.listEntries()).toEqual([{ ...entry, checked: true, priceCents: 238 }]);
  });

  it('supprimer un article le retire de la liste mais garde l’historique, figé', async () => {
    const lait = await store.createItem({ name: 'Lait' });
    await store.addEntry(lait.id);
    await store.closeTrip(plan({ items: [{ itemId: lait.id, name: 'Lait', aisle: 'cremerie', quantity: '1', priceCents: 119 }] }));
    await store.deleteItem(lait.id);
    expect(await store.listEntries()).toEqual([]);
    const [bought] = await store.listTripItems();
    expect(bought).toMatchObject({ itemId: null, name: 'Lait', priceCents: 119 });
  });

  it('supprimer un magasin garde son nom figé sur les courses passées', async () => {
    const shop = await store.createStore('Carrefour');
    await store.closeTrip(plan({ trip: { storeId: shop.id, storeName: 'Carrefour' } }));
    await store.deleteStore(shop.id);
    const [trip] = await store.listTrips();
    expect(trip).toMatchObject({ storeId: null, storeName: 'Carrefour' });
  });

  it('terminer une course applique tout le plan d’un bloc', async () => {
    const lait = await store.createItem({ name: 'Lait', recurrence: 1, defaultQuantity: '2' });
    const piles = await store.createItem({ name: 'Piles' });
    const eLait = await store.addEntry(lait.id, '2');
    const ePiles = await store.addEntry(piles.id);

    const trip = await store.closeTrip(
      plan({
        items: [
          { itemId: lait.id, name: 'Lait', aisle: 'cremerie', quantity: '2', priceCents: 238 },
          { itemId: piles.id, name: 'Piles', aisle: 'autre', quantity: '', priceCents: 599 },
        ],
        purchasedItemIds: [lait.id, piles.id],
        removeEntryIds: [eLait.id, ePiles.id],
        addItemIds: [lait.id],
      }),
    );

    expect(trip.number).toBe(1);
    expect((await store.listTripItems()).map((t) => t.tripId)).toEqual([trip.id, trip.id]);
    expect((await store.listItems()).map((i) => i.lastTripNumber)).toEqual([1, 1]);
    // Le lait (habituel) revient, avec sa quantité par défaut ; les piles non.
    const list = await store.listEntries();
    expect(list.map((e) => [e.itemId, e.quantity, e.checked])).toEqual([[lait.id, '2', false]]);
  });

  it('ne remet jamais deux fois un article sur la liste', async () => {
    const lait = await store.createItem({ name: 'Lait', recurrence: 1 });
    await store.addEntry(lait.id); // pas coché : il reste sur la liste
    await store.closeTrip(plan({ addItemIds: [lait.id] }));
    expect(await store.listEntries()).toHaveLength(1);
  });

  it('refuse d’enregistrer deux fois la même course (même numéro)', async () => {
    await store.closeTrip(plan());
    await expect(store.closeTrip(plan())).rejects.toThrow();
    expect(await store.listTrips()).toHaveLength(1);
  });

  it('liste les courses de la plus récente à la plus ancienne ; en supprimer une emporte ses articles', async () => {
    await store.closeTrip(plan({ items: [{ itemId: null, name: 'Pain', aisle: 'boulangerie', quantity: '', priceCents: null }] }));
    const second = await store.closeTrip(plan({ trip: { number: 2 } }));
    expect((await store.listTrips()).map((t) => t.number)).toEqual([2, 1]);
    const first = (await store.listTrips())[1];
    await store.deleteTrip(first.id);
    expect((await store.listTrips()).map((t) => t.id)).toEqual([second.id]);
    expect(await store.listTripItems()).toEqual([]);
  });

  it('la sauvegarde fait l’aller-retour sans rien perdre', async () => {
    const lait = await store.createItem({ name: 'Lait', recurrence: 3 });
    await store.createStore('Leclerc');
    await store.addEntry(lait.id, '1');
    await store.closeTrip(plan({ items: [{ itemId: lait.id, name: 'Lait', aisle: 'cremerie', quantity: '1', priceCents: 119 }] }));
    const backup = await store.exportData();
    memory.clear();
    await store.importData(backup);
    expect(await store.exportData()).toEqual(backup);
  });

  it('préserve les sections des autres modules dans le blob local partagé', async () => {
    localStorage.setItem('palier.v1', JSON.stringify({ nutritionFoods: [{ id: 'x' }] }));
    await store.createItem({ name: 'Lait' });
    const raw = JSON.parse(localStorage.getItem('palier.v1') ?? '{}');
    expect(raw.nutritionFoods).toEqual([{ id: 'x' }]);
    expect(raw.coursesItems).toHaveLength(1);
  });
});

/** Un plan de clôture minimal, à compléter par cas. */
function plan(overrides: { trip?: Partial<ClosePlan['trip']> } & Partial<Omit<ClosePlan, 'trip'>> = {}): ClosePlan {
  return {
    items: [],
    purchasedItemIds: [],
    removeEntryIds: [],
    addItemIds: [],
    ...overrides,
    trip: { number: 1, day: '2026-09-25', storeId: null, storeName: '', totalCents: 0, note: '', ...overrides.trip },
  };
}
