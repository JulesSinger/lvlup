import { beforeEach, describe, expect, it } from 'vitest';
import { createOutbox } from '../../../core/data/outbox';
import type { ExpenseRequest } from '../../../core/lib/services';
import type { ClosePlan } from '../lib/types';
import type { CourseOp } from './courseOutbox';
import { createCourseWriter } from './courseWriter';
import { LocalCourses } from './localCourses';

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

/** Le stockage local, privé de réseau à la demande (comme les tests de la file de Tâches). */
function flaky() {
  const store = new LocalCourses();
  const state = { offline: false, slow: false };
  const wrapped = new Proxy(store, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        if (state.offline) return Promise.reject(new TypeError('Failed to fetch'));
        if (state.slow) return new Promise((resolve) => setTimeout(() => resolve(value.apply(target, args)), 60));
        return value.apply(target, args);
      };
    },
  });
  return { store, wrapped, state };
}

describe('Courses hors ligne — le rédacteur', () => {
  beforeEach(() => memory.clear());

  it('sans réseau, tout part en file, dans l’ordre, et arrive au retour du réseau sans doublon', async () => {
    const { store, wrapped, state } = flaky();
    const writer = createCourseWriter(wrapped, createOutbox<CourseOp>('courses.outbox.v1'));
    state.offline = true;
    expect((await writer.run({ kind: 'createItem', itemId: 'pain', input: { name: 'Pain' } })).status).toBe('queued');
    await writer.run({ kind: 'addEntry', entryId: 'e1', itemId: 'pain', quantity: '1', note: '' });
    await writer.run({ kind: 'updateEntry', entryId: 'e1', patch: { checked: true } });
    await writer.run({ kind: 'updateEntry', entryId: 'e1', patch: { priceCents: 120 } });
    expect(writer.pending()).toHaveLength(3); // la coche et le prix fondus
    expect(await store.listEntries()).toHaveLength(0);

    state.offline = false;
    const result = await writer.flush();
    expect(result).toMatchObject({ sent: 3, remaining: 0, dropped: [] });
    expect(await store.listEntries()).toMatchObject([{ id: 'e1', itemId: 'pain', checked: true, priceCents: 120 }]);
    // Rejouer ne double rien.
    await store.addEntry('pain', '1', '', 'e1');
    expect(await store.listEntries()).toHaveLength(1);
  });

  it('une file non vide fait passer la suite par elle : jamais une coche récente écrasée par une ancienne', async () => {
    const { store, wrapped, state } = flaky();
    await store.createItem({ name: 'Lait' }, 'lait');
    await store.addEntry('lait', '', '', 'e1');
    const writer = createCourseWriter(wrapped, createOutbox<CourseOp>('courses.outbox.v1'));
    state.offline = true;
    await writer.run({ kind: 'updateEntry', entryId: 'e1', patch: { checked: true } });
    state.offline = false;
    // Le réseau revient, mais la file n'est pas vide : la décoche passe derrière la coche.
    const second = await writer.run({ kind: 'updateEntry', entryId: 'e1', patch: { checked: false } });
    expect(second.status).toBe('queued');
    await writer.flush();
    expect((await store.listEntries())[0].checked).toBe(false);
  });

  it('une écriture trop lente part en file, et ne double rien quand elle aboutit quand même', async () => {
    const { store, wrapped, state } = flaky();
    const writer = createCourseWriter(wrapped, createOutbox<CourseOp>('courses.outbox.v1'), 10);
    state.slow = true;
    expect((await writer.run({ kind: 'createItem', itemId: 'cafe', input: { name: 'Café' } })).status).toBe('queued');
    await writer.flush();
    expect(await store.listItems()).toHaveLength(1);
  });

  it('une course terminée hors ligne part au retour du réseau, avec sa dépense ; rejouée, elle n’est pas doublée', async () => {
    const { store, wrapped, state } = flaky();
    await store.createItem({ name: 'Lait', recurrence: 1 }, 'lait');
    await store.addEntry('lait', '', '', 'e1');
    await store.updateEntry('e1', { checked: true, priceCents: 230 });
    const recorded: ExpenseRequest[] = [];
    const writer = createCourseWriter(wrapped, createOutbox<CourseOp>('courses.outbox.v1'));
    writer.useExpenses({ record: async (r) => void recorded.push(r), remove: async () => {}, recorded: async () => new Set() });
    const plan: ClosePlan = {
      trip: { number: 1, day: '2026-11-09', storeId: 'auchan', storeName: 'Auchan', totalCents: 230, note: '' },
      items: [{ itemId: 'lait', name: 'Lait', aisle: 'cremerie', quantity: '', priceCents: 230 }],
      purchasedItemIds: ['lait'],
      removeEntryIds: ['e1'],
      addItemIds: ['lait'],
    };
    state.offline = true;
    await writer.run({ kind: 'createStore', storeId: 'auchan', name: 'Auchan' });
    await writer.run({ kind: 'closeTrip', plan, budget: { accountId: 'pluxee' } });
    state.offline = false;
    expect(await writer.flush()).toMatchObject({ sent: 2, dropped: [] });
    expect(await store.listTrips()).toHaveLength(1);
    expect(recorded).toMatchObject([{ ref: 'comete:course:1', amountCents: 230, accountId: 'pluxee' }]);
    expect((await store.listEntries()).map((e) => e.itemId)).toEqual(['lait']); // l'habituel revenu

    // Rejouée (l'envoi avait réussi juste avant une coupure) : reconnue, pas doublée.
    const again = createCourseWriter(wrapped, createOutbox<CourseOp>('courses.outbox.v1'));
    state.offline = true;
    await again.run({ kind: 'closeTrip', plan, budget: null });
    state.offline = false;
    await again.flush();
    expect(await store.listTrips()).toHaveLength(1);
  });

  it('un numéro pris entre-temps par une autre course : celle du téléphone prend le suivant', async () => {
    const { store, wrapped, state } = flaky();
    const writer = createCourseWriter(wrapped, createOutbox<CourseOp>('courses.outbox.v1'));
    const plan = (n: number, total: number): ClosePlan => ({
      trip: { number: n, day: '2026-11-09', storeId: null, storeName: 'Auchan', totalCents: total, note: '' },
      items: [],
      purchasedItemIds: [],
      removeEntryIds: [],
      addItemIds: [],
    });
    state.offline = true;
    await writer.run({ kind: 'closeTrip', plan: plan(1, 500), budget: null });
    state.offline = false;
    await store.closeTrip(plan(1, 999)); // faite ailleurs pendant ce temps
    await writer.flush();
    expect((await store.listTrips()).map((t) => [t.number, t.totalCents]).sort()).toEqual([
      [1, 999],
      [2, 500],
    ]);
  });
});
