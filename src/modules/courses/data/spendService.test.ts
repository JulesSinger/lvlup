import { beforeEach, describe, expect, it } from 'vitest';
import { LocalCourses } from './localCourses';
import { createSpendService } from './spendService';

// Le contenu des courses rendu à Budget (docs/etude-courses-typologies.md §4).
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

describe('le service shoppingSpend', () => {
  let store: LocalCourses;
  beforeEach(() => {
    memory.clear();
    store = new LocalCourses();
  });

  async function trip(number: number, totalCents: number, lines: { itemId: string | null; name: string; aisle: 'epicerie_salee' | 'boissons' | 'autre'; priceCents: number | null }[]) {
    await store.closeTrip({
      trip: { number, day: `2026-10-1${number}`, storeId: null, storeName: 'Auchan', totalCents, note: '' },
      items: lines.map((l) => ({ ...l, quantity: '1' })),
      purchasedItemIds: [],
      removeEntryIds: [],
      addItemIds: [],
    });
  }

  it('rend le contenu des courses demandées, classé, remises à part', async () => {
    const chips = await store.createItem({ name: 'Chips', aisle: 'epicerie_salee' });
    await trip(1, 1000, [
      { itemId: chips.id, name: 'Chips', aisle: 'epicerie_salee', priceCents: 200 },
      { itemId: null, name: 'Bières', aisle: 'boissons', priceCents: 600 },
      { itemId: null, name: 'Riz', aisle: 'epicerie_salee', priceCents: 300 },
    ]);
    await trip(2, 500, [{ itemId: null, name: 'Riz', aisle: 'epicerie_salee', priceCents: 500 }]);
    const service = createSpendService(store);
    const [one] = await service.trips(['comete:course:1', 'comete:course:9']);
    expect(one).toMatchObject({ ref: 'comete:course:1', store: 'Auchan', adjustmentCents: -100, undetailedCents: 0 });
    expect(one.byKey).toEqual({ 'alimentation:plaisir': 200, 'alimentation:alcool': 600, 'alimentation:essentiel': 300 });
    expect(await service.trips([])).toEqual([]);
  });

  it('reclasser l’article d’une ligne vaut pour toutes ses courses ; une ligne sans article, pour elle seule', async () => {
    const kit = await store.createItem({ name: 'Kit de préparation', aisle: 'epicerie_salee' });
    await trip(1, 300, [{ itemId: kit.id, name: 'Kit de préparation', aisle: 'epicerie_salee', priceCents: 300 }]);
    await trip(2, 2690, [
      { itemId: kit.id, name: 'Kit de préparation', aisle: 'epicerie_salee', priceCents: 300 },
      { itemId: null, name: 'Objet bizarre', aisle: 'autre', priceCents: 2390 },
    ]);
    const service = createSpendService(store);
    const [, second] = await service.trips(['comete:course:1', 'comete:course:2']).then((t) => t.sort((a, b) => a.ref.localeCompare(b.ref)));
    await service.classify(second.lines.find((l) => l.name === 'Kit de préparation')!.id, 'alimentation', 'plaisir');
    await service.classify(second.lines.find((l) => l.name === 'Objet bizarre')!.id, 'maison', null);
    const after = (await service.trips(['comete:course:1', 'comete:course:2'])).sort((a, b) => a.ref.localeCompare(b.ref));
    expect(after[0].byKey).toEqual({ 'alimentation:plaisir': 300 });
    expect(after[1].byKey).toEqual({ 'alimentation:plaisir': 300, maison: 2390 });
    await expect(service.classify('inconnue', 'maison', null)).rejects.toThrow(/n’existe plus/);
    await expect(service.classify(second.lines[0].id, 'jardin', null)).rejects.toThrow(/inconnue/);
  });
});
