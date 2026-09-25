import { describe, expect, it } from 'vitest';
import { buildClosePlan, isDue, nextTripNumber, recurrenceLabel, suggestedTotal } from './trip';
import type { Item, ListEntry } from './types';

const item = (id: string, recurrence: number | null, lastTripNumber: number | null = null): Item => ({
  id,
  name: id,
  aisle: 'autre',
  recurrence,
  defaultQuantity: '',
  lastTripNumber,
  createdAt: '',
});

const entry = (id: string, itemId: string, checked: boolean, priceCents: number | null = null): ListEntry => ({
  id,
  itemId,
  quantity: '1',
  note: '',
  checked,
  priceCents,
  createdAt: '',
});

describe('recurrenceLabel', () => {
  it('dit la récurrence comme on la dit', () => {
    expect(recurrenceLabel(null)).toBe('ponctuel');
    expect(recurrenceLabel(1)).toBe('à chaque course');
    expect(recurrenceLabel(3)).toBe('toutes les 3 courses');
  });
});

describe('nextTripNumber', () => {
  it('1 pour la première course, puis le plus grand numéro + 1', () => {
    expect(nextTripNumber([])).toBe(1);
    expect(nextTripNumber([{ number: 2 }, { number: 5 }, { number: 3 }])).toBe(6);
  });
});

describe('isDue', () => {
  it('un ponctuel n’est jamais dû', () => {
    expect(isDue(item('piles', null, 1), 10)).toBe(false);
  });

  it('un habituel jamais acheté est toujours dû', () => {
    expect(isDue(item('lait', 3), 1)).toBe(true);
  });

  it('acheté à la course n° k avec une récurrence N, il revient pour la course k + N', () => {
    const lessive = item('lessive', 3, 5);
    expect([6, 7, 8, 9].map((n) => isDue(lessive, n))).toEqual([false, false, true, true]);
    expect(isDue(item('lait', 1, 5), 6)).toBe(true);
  });
});

describe('suggestedTotal', () => {
  it('additionne les prix des lignes cochées, et dit combien n’en ont pas', () => {
    const entries = [entry('a', 'x', true, 238), entry('b', 'y', true, 599), entry('c', 'z', true), entry('d', 'w', false, 100)];
    expect(suggestedTotal(entries)).toEqual({ totalCents: 837, priced: 2, unpriced: 1 });
  });
});

describe('buildClosePlan', () => {
  const base = { day: '2026-09-25', store: { id: 's1', name: 'Leclerc' } };

  it('archive les lignes cochées avec leurs prix, et les retire de la liste', () => {
    const plan = buildClosePlan({
      ...base,
      items: [item('lait', 1), item('piles', null)],
      entries: [entry('e1', 'lait', true, 238), entry('e2', 'piles', false)],
      trips: [],
    });
    expect(plan.trip).toEqual({ number: 1, day: '2026-09-25', storeId: 's1', storeName: 'Leclerc', totalCents: 238, note: '' });
    expect(plan.items).toEqual([{ itemId: 'lait', name: 'lait', aisle: 'autre', quantity: '1', priceCents: 238 }]);
    expect(plan.purchasedItemIds).toEqual(['lait']);
    expect(plan.removeEntryIds).toEqual(['e1']);
  });

  it('un habituel « à chaque course » acheté revient aussitôt ; un ponctuel acheté non', () => {
    const plan = buildClosePlan({
      ...base,
      items: [item('lait', 1), item('piles', null)],
      entries: [entry('e1', 'lait', true), entry('e2', 'piles', true)],
      trips: [],
    });
    expect(plan.addItemIds).toEqual(['lait']);
  });

  it('un habituel « toutes les 3 courses » acheté ne revient pas tout de suite', () => {
    const plan = buildClosePlan({
      ...base,
      items: [item('lessive', 3), item('lait', 1)],
      entries: [entry('e1', 'lessive', true), entry('e2', 'lait', true)],
      trips: [{ number: 4 }],
    });
    expect(plan.trip.number).toBe(5);
    expect(plan.addItemIds).toEqual(['lait']);
  });

  it('un habituel absent de la liste revient quand son tour arrive', () => {
    // Lessive achetée à la course 3, toutes les 3 courses : due pour la 6.
    // On clôt la course 5 → elle est remise pour la 6.
    const plan = buildClosePlan({
      ...base,
      items: [item('lessive', 3, 3), item('lait', 1)],
      entries: [entry('e1', 'lait', true)],
      trips: [{ number: 4 }],
    });
    expect(plan.addItemIds.sort()).toEqual(['lait', 'lessive']);
  });

  it('une ligne non cochée reste, et son article n’est pas ajouté une seconde fois', () => {
    const plan = buildClosePlan({
      ...base,
      items: [item('lait', 1), item('pain', 1)],
      entries: [entry('e1', 'lait', true), entry('e2', 'pain', false)],
      trips: [],
    });
    expect(plan.removeEntryIds).toEqual(['e1']);
    expect(plan.addItemIds).toEqual(['lait']);
  });

  it('le total du ticket l’emporte sur la somme des prix', () => {
    const plan = buildClosePlan({
      ...base,
      items: [item('lait', 1)],
      entries: [entry('e1', 'lait', true, 238)],
      trips: [],
      totalCents: 4780,
      note: 'promo sur le total',
    });
    expect(plan.trip.totalCents).toBe(4780);
    expect(plan.trip.note).toBe('promo sur le total');
  });

  it('refuse une course sans rien de coché', () => {
    expect(() =>
      buildClosePlan({ ...base, items: [item('lait', 1)], entries: [entry('e1', 'lait', false)], trips: [] }),
    ).toThrow('Coche au moins un article');
  });
});
