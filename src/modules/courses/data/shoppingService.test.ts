import { beforeEach, describe, expect, it } from 'vitest';
import { LocalCourses } from './localCourses';
import { createShoppingService, mergeQuantity } from './shoppingService';

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

describe('le service shopping rendu par Courses', () => {
  beforeEach(() => memory.clear());

  it('crée les articles inconnus dans leur rayon, retrouve les autres au pluriel près', async () => {
    const store = new LocalCourses();
    const oignon = await store.createItem({ name: 'Oignon jaune', aisle: 'fruits_legumes' });
    const service = createShoppingService(store);
    const r = await service.add([
      { name: 'oignons jaunes', quantity: '3', note: 'Lasagnes' },
      { name: 'boeuf haché', quantity: '500 g', note: 'Lasagnes' },
    ]);
    expect(r).toEqual({ added: 2, merged: 0 });
    const items = await store.listItems();
    expect(items).toHaveLength(2);
    const entries = await store.listEntries();
    expect(entries.find((e) => e.itemId === oignon.id)).toMatchObject({ quantity: '3', note: 'Lasagnes' });
  });

  it('un article déjà sur la liste : une seule ligne, quantité complétée, décoché', async () => {
    const store = new LocalCourses();
    const lait = await store.createItem({ name: 'Lait' });
    const entry = await store.addEntry(lait.id, '1 l', '');
    await store.updateEntry(entry.id, { checked: true });
    const r = await createShoppingService(store).add([{ name: 'lait', quantity: '90 cl', note: 'Crêpes' }]);
    expect(r).toEqual({ added: 0, merged: 1 });
    const entries = await store.listEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ quantity: '1 l + 90 cl', note: 'Crêpes', checked: false });
  });

  it('une quantité trop longue pour la colonne part dans la note', () => {
    expect(mergeQuantity('', '500 g', '')).toEqual({ quantity: '500 g', note: '' });
    expect(mergeQuantity('1 kg', '', 'x')).toEqual({ quantity: '1 kg', note: 'x' });
    expect(mergeQuantity('2 gousses + 3 gousses', '1 gousse + 200 g', '')).toEqual({ quantity: '2 gousses + 3 gousses', note: '+ 1 gousse + 200 g' });
  });
});
