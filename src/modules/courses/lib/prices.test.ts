import { describe, expect, it } from 'vitest';
import { estimateList, lastPrice, priceHistory } from './prices';
import type { ListEntry, Trip, TripItem } from './types';

const trip = (id: string, number: number, storeId: string | null, storeName: string, day: string): Trip => ({
  id,
  number,
  day,
  storeId,
  storeName,
  totalCents: 0,
  note: '',
  createdAt: '',
});

const bought = (tripId: string, itemId: string, priceCents: number | null): TripItem => ({
  id: `${tripId}-${itemId}`,
  tripId,
  itemId,
  name: itemId,
  aisle: 'autre',
  quantity: '1',
  priceCents,
});

const trips = [
  trip('t1', 1, 'leclerc', 'Leclerc', '2026-09-01'),
  trip('t2', 2, 'carrefour', 'Carrefour', '2026-09-08'),
  trip('t3', 3, 'leclerc', 'Leclerc', '2026-09-15'),
];
const tripItems = [
  bought('t1', 'lait', 115),
  bought('t2', 'lait', 129),
  bought('t3', 'lait', 119),
  bought('t3', 'cafe', null), // acheté sans prix
];

describe('priceHistory', () => {
  it('les prix payés, du plus ancien au plus récent, avec le magasin', () => {
    expect(priceHistory('lait', tripItems, trips).map((p) => [p.storeName, p.priceCents])).toEqual([
      ['Leclerc', 115],
      ['Carrefour', 129],
      ['Leclerc', 119],
    ]);
  });

  it('ignore les achats sans prix', () => {
    expect(priceHistory('cafe', tripItems, trips)).toEqual([]);
  });
});

describe('lastPrice', () => {
  it('le dernier prix dans ce magasin', () => {
    expect(lastPrice('lait', tripItems, trips, 'carrefour')).toEqual({ priceCents: 129, sameStore: true, storeName: 'Carrefour' });
  });

  it('à défaut, le dernier prix ailleurs, en le disant', () => {
    expect(lastPrice('lait', tripItems, trips, 'lidl')).toEqual({ priceCents: 119, sameStore: false, storeName: 'Leclerc' });
  });

  it('aucun prix connu : rien', () => {
    expect(lastPrice('cafe', tripItems, trips)).toBeNull();
  });
});

describe('estimateList', () => {
  const entry = (itemId: string, priceCents: number | null = null): ListEntry => ({
    id: itemId,
    itemId,
    quantity: '',
    note: '',
    checked: false,
    priceCents,
    createdAt: '',
  });

  it('additionne les derniers prix du magasin choisi, et compte ce qu’on ne sait pas', () => {
    expect(estimateList([entry('lait'), entry('cafe')], tripItems, trips, 'carrefour')).toEqual({
      totalCents: 129,
      known: 1,
      unknown: 1,
    });
  });

  it('un prix déjà saisi sur la ligne l’emporte sur l’historique', () => {
    expect(estimateList([entry('lait', 99)], tripItems, trips, 'leclerc').totalCents).toBe(99);
  });
});
