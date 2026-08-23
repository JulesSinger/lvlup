import { beforeEach, describe, expect, it } from 'vitest';
import { LocalBudget } from './localBudget';

/**
 * Le module s'appuie sur localStorage ; en environnement Node on en fournit
 * une version minimale plutôt que de tirer tout un DOM — même motif que
 * `modules/objectifs/data/outbox.test.ts`.
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

describe('LocalBudget', () => {
  let store: LocalBudget;

  beforeEach(() => {
    memory.clear();
    store = new LocalBudget();
  });

  it('crée une catégorie avec ses valeurs par défaut', async () => {
    const category = await store.createCategory({ name: 'Courses' });
    expect(category.kind).toBe('variable');
    expect(category.position).toBe(0);
    expect(await store.listCategories()).toEqual([category]);
  });

  it('numérote les catégories dans leur ordre de création', async () => {
    await store.createCategory({ name: 'Loyer', kind: 'fixe' });
    await store.createCategory({ name: 'Courses', kind: 'variable' });
    const positions = (await store.listCategories()).map((c) => c.position);
    expect(positions).toEqual([0, 1]);
  });

  it('arrondit un montant en centimes entiers, jamais en flottant', async () => {
    const entry = await store.createEntry({ day: '2026-07-04', label: 'Test', amountCents: -1234.6 });
    expect(entry.amountCents).toBe(-1235);
    expect(Number.isInteger(entry.amountCents)).toBe(true);
  });

  it('une écriture sans catégorie reste « à classer », pas masquée', async () => {
    const entry = await store.createEntry({ day: '2026-07-01', label: 'Non catégorisé', amountCents: -500 });
    expect(entry.categoryId).toBeNull();
    expect(await store.listEntries()).toContainEqual(entry);
  });

  it('supprimer une catégorie remet ses écritures et règles « à classer »', async () => {
    const category = await store.createCategory({ name: 'Loisirs' });
    const entry = await store.createEntry({
      day: '2026-07-10',
      label: 'Concert',
      amountCents: -4500,
      categoryId: category.id,
    });
    await store.createRule({ pattern: 'CONCERT', categoryId: category.id });

    await store.deleteCategory(category.id);

    const [updated] = await store.listEntries();
    expect(updated.id).toBe(entry.id);
    expect(updated.categoryId).toBeNull();
    expect(await store.listRules()).toEqual([]);
  });

  it('exporte puis réimporte fidèlement', async () => {
    await store.createCategory({ name: 'Salaire', kind: 'revenu' });
    await store.createEntry({ day: '2026-07-01', label: 'Virement', amountCents: 250000 });
    const backup = await store.exportData();

    const restored = new LocalBudget();
    await restored.importData(backup);

    expect(await restored.listCategories()).toEqual(backup.categories);
    expect(await restored.listEntries()).toEqual(backup.entries);
  });
});
