import { beforeEach, describe, expect, it } from 'vitest';
import type { EntryInput } from '../lib/types';
import { LocalNutrition } from './localNutrition';

/**
 * Le module s'appuie sur localStorage ; en environnement Node on en fournit
 * une version minimale plutôt que de tirer tout un DOM — même motif que
 * `modules/flashcards/data/localFlashcards.test.ts`.
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

const skyr = { name: 'Skyr nature', kcal: 63, proteinDg: 110, carbsDg: 40, fatDg: 2 };

function entry(overrides: Partial<EntryInput> = {}): EntryInput {
  return {
    day: '2026-09-25',
    meal: 'breakfast',
    foodId: null,
    ciqualCode: '13000',
    label: 'Pomme crue',
    grams: 150,
    kcal: 80,
    proteinDg: 4,
    carbsDg: 170,
    fatDg: 3,
    ...overrides,
  };
}

describe('LocalNutrition', () => {
  let store: LocalNutrition;

  beforeEach(() => {
    memory.clear();
    store = new LocalNutrition();
  });

  it('crée un aliment perso avec ses valeurs par défaut', async () => {
    const food = await store.createFood(skyr);
    expect(food).toMatchObject({
      source: 'custom',
      barcode: null,
      brand: null,
      fiberDg: null,
      servingGrams: null,
      favorite: false,
    });
    expect(await store.listFoods()).toEqual([food]);
  });

  it('refuse un deuxième aliment avec le même code-barres, comme l’index unique de la base', async () => {
    await store.createFood({ ...skyr, source: 'off', barcode: '3033490004743' });
    await expect(store.createFood({ ...skyr, barcode: '3033490004743' })).rejects.toThrow();
  });

  it('corriger un aliment ne réécrit pas les entrées déjà saisies (valeurs figées)', async () => {
    const food = await store.createFood(skyr);
    await store.createEntry(entry({ foodId: food.id, ciqualCode: null, label: 'Skyr nature', kcal: 95 }));
    await store.updateFood(food.id, { kcal: 70, name: 'Skyr' });
    const [saved] = await store.listEntries('2026-09-25', '2026-09-25');
    expect(saved.kcal).toBe(95);
    expect(saved.label).toBe('Skyr nature');
  });

  it('supprimer un aliment garde les entrées, sans leur référence', async () => {
    const food = await store.createFood(skyr);
    await store.createEntry(entry({ foodId: food.id, ciqualCode: null }));
    await store.deleteFood(food.id);
    const entries = await store.listEntries('2026-09-25', '2026-09-25');
    expect(entries).toHaveLength(1);
    expect(entries[0].foodId).toBeNull();
  });

  it('ne liste que les entrées de la période demandée, bornes comprises', async () => {
    await store.createEntry(entry({ day: '2026-09-23' }));
    await store.createEntry(entry({ day: '2026-09-24' }));
    await store.createEntry(entry({ day: '2026-09-25' }));
    await store.createEntry(entry({ day: '2026-09-26' }));
    const days = (await store.listEntries('2026-09-24', '2026-09-25')).map((e) => e.day);
    expect(days.sort()).toEqual(['2026-09-24', '2026-09-25']);
  });

  it('modifie puis supprime une entrée', async () => {
    const created = await store.createEntry(entry());
    await store.updateEntry(created.id, { grams: 200, kcal: 107, meal: 'snack' });
    const [updated] = await store.listEntries('2026-09-25', '2026-09-25');
    expect(updated).toMatchObject({ grams: 200, kcal: 107, meal: 'snack', label: 'Pomme crue' });
    await store.deleteEntry(created.id);
    expect(await store.listEntries('2026-09-25', '2026-09-25')).toEqual([]);
  });

  it('un jour n’a qu’un objectif : le reposer le remplace', async () => {
    await store.setTarget({ effectiveFrom: '2026-10-01', proteinG: 140, carbsG: 250, fatG: 70 });
    await store.setTarget({ effectiveFrom: '2026-09-01', proteinG: 120, carbsG: 280, fatG: 80 });
    await store.setTarget({ effectiveFrom: '2026-10-01', proteinG: 150, carbsG: 240, fatG: 70 });
    const targets = await store.listTargets();
    expect(targets.map((t) => [t.effectiveFrom, t.proteinG])).toEqual([
      ['2026-09-01', 120],
      ['2026-10-01', 150],
    ]);
    await store.deleteTarget(targets[0].id);
    expect(await store.listTargets()).toHaveLength(1);
  });

  it('la sauvegarde fait l’aller-retour sans rien perdre', async () => {
    const food = await store.createFood(skyr);
    await store.createEntry(entry({ foodId: food.id, ciqualCode: null }));
    await store.setTarget({ effectiveFrom: '2026-09-25', proteinG: 140, carbsG: 250, fatG: 70 });
    const backup = await store.exportData();

    memory.clear();
    await store.importData(backup);
    expect(await store.exportData()).toEqual(backup);
  });

  it('préserve les sections des autres modules dans le blob local partagé', async () => {
    localStorage.setItem('palier.v1', JSON.stringify({ flashcardsDecks: [{ id: 'x' }] }));
    await store.createFood(skyr);
    const raw = JSON.parse(localStorage.getItem('palier.v1') ?? '{}');
    expect(raw.flashcardsDecks).toEqual([{ id: 'x' }]);
    expect(raw.nutritionFoods).toHaveLength(1);
  });
});
