import { describe, expect, it } from 'vitest';
import { findItemByName, findStoreByName, storesByUse, suggestItems } from './catalog';
import type { Item, ListEntry } from './types';

const item = (id: string, name: string, recurrence: number | null = null, lastTripNumber: number | null = null): Item => ({
  id,
  name,
  aisle: 'autre',
  recurrence,
  defaultQuantity: '',
  lastTripNumber,
  createdAt: '',
});
const entry = (itemId: string): ListEntry => ({
  id: `e-${itemId}`,
  itemId,
  quantity: '',
  note: '',
  checked: false,
  priceCents: null,
  createdAt: '',
});

const items = [
  item('lait', 'Lait demi-écrémé', 1, 3),
  item('lessive', 'Lessive', 3, 3),
  item('piles', 'Piles AA'),
  item('pain', 'Pain complet', 1, 1),
];

describe('findItemByName', () => {
  it('retrouve un article sans tenir compte de la casse, des accents ni des espaces', () => {
    expect(findItemByName(items, '  lait DEMI ecreme ')?.id).toBe('lait');
  });

  it('rien pour un nom inconnu ou vide', () => {
    expect(findItemByName(items, 'Beurre')).toBeNull();
    expect(findItemByName(items, '  ')).toBeNull();
  });
});

describe('suggestItems', () => {
  it('propose les articles dont un mot commence par chaque mot tapé', () => {
    expect(suggestItems(items, [], 'dem', 4).map((i) => i.id)).toEqual(['lait']);
    expect(suggestItems(items, [], 'pa', 4).map((i) => i.id)).toEqual(['pain']);
  });

  it('écarte ce qui est déjà sur la liste', () => {
    expect(suggestItems(items, [entry('lait')], 'lait', 4)).toEqual([]);
  });

  it('sans rien taper : les habituels dus d’abord, puis les autres habituels, puis les ponctuels', () => {
    // Course suivante n° 4 : lait (à chaque course) et pain sont dus, la lessive (toutes les 3) pas encore.
    expect(suggestItems(items, [], '', 4).map((i) => i.id)).toEqual(['lait', 'pain', 'lessive', 'piles']);
  });

  it('respecte la limite', () => {
    expect(suggestItems(items, [], '', 4, 2)).toHaveLength(2);
  });
});

describe('findStoreByName', () => {
  const stores = [{ id: 's1', name: 'Leclerc Drive', createdAt: '' }];
  it('retrouve un magasin à la casse et aux accents près', () => {
    expect(findStoreByName(stores, ' leclerc DRIVE ')?.id).toBe('s1');
    expect(findStoreByName(stores, 'Lidl')).toBeNull();
  });
});

describe('storesByUse', () => {
  const store = (id: string, name: string) => ({ id, name, createdAt: '' });
  const trip = (number: number, storeId: string | null) => ({
    id: `t${number}`,
    number,
    day: '2026-09-01',
    storeId,
    storeName: '',
    totalCents: 0,
    note: '',
    createdAt: '',
  });

  it('le plus fréquenté d’abord, puis le plus récent, puis par nom', () => {
    const stores = [store('a', 'Auchan'), store('c', 'Carrefour'), store('l', 'Leclerc'), store('m', 'Monoprix')];
    const trips = [trip(1, 'c'), trip(2, 'l'), trip(3, 'l'), trip(4, 'a'), trip(5, null)];
    expect(storesByUse(stores, trips).map((s) => s.name)).toEqual(['Leclerc', 'Auchan', 'Carrefour', 'Monoprix']);
  });
});
