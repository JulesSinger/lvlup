import { describe, expect, it } from 'vitest';
import type { ClosePlan, Item, ListEntry } from '../lib/types';
import { applyPending, isPendingId, stamp, withOp, type CourseData } from './courseOutbox';

const item = (id: string, over: Partial<Item> = {}): Item => ({
  id,
  name: id,
  aisle: 'autre',
  recurrence: null,
  defaultQuantity: '',
  lastTripNumber: null,
  createdAt: '',
  ...over,
});
const entry = (id: string, itemId: string, over: Partial<ListEntry> = {}): ListEntry => ({
  id,
  itemId,
  quantity: '',
  note: '',
  checked: false,
  priceCents: null,
  createdAt: '',
  ...over,
});
const data = (over: Partial<CourseData> = {}): CourseData => ({ items: [], entries: [], stores: [], trips: [], tripItems: [], ...over });

describe('Courses hors ligne — la file', () => {
  it('cocher puis saisir un prix d’une même ligne ne fait qu’une modification', () => {
    let ops = withOp([], stamp({ kind: 'updateEntry', entryId: 'e1', patch: { checked: true } }));
    ops = withOp(ops, stamp({ kind: 'updateEntry', entryId: 'e2', patch: { checked: true } }));
    ops = withOp(ops, stamp({ kind: 'updateEntry', entryId: 'e1', patch: { priceCents: 129 } }));
    expect(ops).toHaveLength(2);
    expect(ops[0]).toMatchObject({ entryId: 'e1', patch: { checked: true, priceCents: 129 } });
  });

  it('une course terminée sépare les modifications : celle d’après reste à part', () => {
    const plan = { trip: { number: 1, day: '2026-11-09', storeId: null, storeName: 'Auchan', totalCents: 100, note: '' }, items: [], purchasedItemIds: [], removeEntryIds: [], addItemIds: [] };
    let ops = withOp([], stamp({ kind: 'updateEntry', entryId: 'e1', patch: { checked: true } }));
    ops = withOp(ops, stamp({ kind: 'closeTrip', plan, budget: null }));
    ops = withOp(ops, stamp({ kind: 'updateEntry', entryId: 'e1', patch: { checked: false } }));
    expect(ops).toHaveLength(3);
  });

  it('l’écran montre ce qui a été fait sans réseau : ajout, coche, retrait', () => {
    const server = data({ items: [item('lait')], entries: [entry('e1', 'lait'), entry('e2', 'lait')] });
    const ops = [
      stamp({ kind: 'createItem', itemId: 'pain', input: { name: 'Pain', aisle: 'boulangerie' } }),
      stamp({ kind: 'addEntry', entryId: 'e3', itemId: 'pain', quantity: '1', note: '' }),
      stamp({ kind: 'updateEntry', entryId: 'e1', patch: { checked: true, priceCents: 115 } }),
      stamp({ kind: 'removeEntry', entryId: 'e2' }),
    ];
    const shown = applyPending(server, ops);
    expect(shown.items.map((i) => i.name)).toEqual(['lait', 'Pain']);
    expect(shown.entries.map((e) => [e.id, e.checked, e.priceCents])).toEqual([
      ['e1', true, 115],
      ['e3', false, null],
    ]);
    // Déjà reçu par le serveur (envoi réussi juste avant la coupure) : pas doublé.
    expect(applyPending({ ...server, entries: [...server.entries, entry('e3', 'pain')] }, ops).entries.filter((e) => e.id === 'e3')).toHaveLength(1);
  });

  it('une course terminée hors ligne apparaît, vide la liste et remet les habituels', () => {
    const server = data({
      items: [item('lait', { recurrence: 1, defaultQuantity: '2' }), item('piles')],
      entries: [entry('e1', 'lait', { checked: true, priceCents: 230 }), entry('e2', 'piles')],
    });
    const plan: ClosePlan = {
      trip: { number: 4, day: '2026-11-09', storeId: null, storeName: 'Auchan', totalCents: 230, note: '' },
      items: [{ itemId: 'lait', name: 'lait', aisle: 'cremerie', quantity: '2', priceCents: 230 }],
      purchasedItemIds: ['lait'],
      removeEntryIds: ['e1'],
      addItemIds: ['lait'],
    };
    const shown = applyPending(server, [stamp({ kind: 'closeTrip', plan, budget: {} })]);
    expect(shown.trips.map((t) => [t.number, t.storeName, t.totalCents])).toEqual([[4, 'Auchan', 230]]);
    expect(shown.tripItems).toHaveLength(1);
    expect(shown.items.find((i) => i.id === 'lait')?.lastTripNumber).toBe(4);
    expect(shown.entries.map((e) => e.itemId).sort()).toEqual(['lait', 'piles']);
    expect(isPendingId(shown.entries.find((e) => e.itemId === 'lait')!.id)).toBe(true);

    // Une fois partie, la course du serveur n'est pas doublée par celle en attente.
    const sent = { ...server, trips: [{ id: 't4', ...plan.trip, createdAt: '' }] };
    expect(applyPending(sent, [stamp({ kind: 'closeTrip', plan, budget: {} })]).trips).toHaveLength(1);
  });
});
