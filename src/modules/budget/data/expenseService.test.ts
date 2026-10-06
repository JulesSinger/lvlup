import { beforeEach, describe, expect, it } from 'vitest';
import { createExpenseService } from './expenseService';
import { LocalBudget } from './localBudget';

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

const request = {
  ref: 'comete:course:1',
  day: '2026-09-26',
  label: 'Courses — Leclerc',
  amountCents: 4780,
  categoryName: 'Courses',
  note: 'Courses, course n° 1',
};

describe('le service de dépenses d’Astra', () => {
  let store: LocalBudget;

  beforeEach(() => {
    memory.clear();
    store = new LocalBudget();
  });

  it('enregistre une dépense négative dans la catégorie demandée, trouvée sans casse ni accents', async () => {
    const courses = await store.createCategory({ name: 'Courses', emoji: '🛒', color: '#e0724c', kind: 'variable' });
    await createExpenseService(store).record({ ...request, categoryName: 'COURSES' });
    const [entry] = await store.listEntries();
    expect(entry).toMatchObject({
      day: '2026-09-26',
      label: 'Courses — Leclerc',
      amountCents: -4780,
      categoryId: courses.id,
      source: 'manuelle',
      importKey: 'comete:course:1',
      note: 'Courses, course n° 1',
    });
  });

  it('une entrée est positive : un paiement reçu d’un client de Projets', async () => {
    const revenus = await store.createCategory({ name: 'Revenus freelance', emoji: '💼', color: '#6fa8f5', kind: 'revenu' });
    await createExpenseService(store).record({
      ref: 'projets:paiement:1',
      day: '2026-10-06',
      label: 'Fleurs de Lou — Acompte 30 %',
      amountCents: 27_000,
      categoryName: 'revenus freelance',
      direction: 'income',
    });
    expect((await store.listEntries())[0]).toMatchObject({ amountCents: 27_000, categoryId: revenus.id, importKey: 'projets:paiement:1' });
  });

  it('sans catégorie de ce nom, la dépense est « à classer »', async () => {
    await createExpenseService(store).record(request);
    expect((await store.listEntries())[0].categoryId).toBeNull();
  });

  it('enregistrer deux fois la même référence ne crée qu’une dépense', async () => {
    const service = createExpenseService(store);
    await service.record(request);
    await service.record({ ...request, amountCents: 9999 });
    expect(await store.listEntries()).toHaveLength(1);
  });

  it('dit quelles références sont enregistrées, et retire celle qu’on demande', async () => {
    const service = createExpenseService(store);
    await service.record(request);
    await service.record({ ...request, ref: 'comete:course:2' });
    expect([...(await service.recorded(['comete:course:1', 'comete:course:3']))]).toEqual(['comete:course:1']);
    await service.remove('comete:course:1');
    expect((await store.listEntries()).map((e) => e.importKey)).toEqual(['comete:course:2']);
    await service.remove('comete:course:9'); // sans effet
    expect(await store.listEntries()).toHaveLength(1);
  });

  it('ne touche jamais une écriture importée de la banque', async () => {
    await store.createEntry({ day: '2026-09-26', label: 'CB LECLERC', amountCents: -4780, source: 'import', importKey: '2026-09-26|CB LECLERC|-4780|0' });
    await createExpenseService(store).remove('comete:course:1');
    expect(await store.listEntries()).toHaveLength(1);
  });
});
