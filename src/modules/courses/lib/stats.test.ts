import { describe, expect, it } from 'vitest';
import { centsToInput, formatEuros, parseEurosToCents } from './money';
import { averageBasket, byStore, monthlyTotals } from './stats';
import type { Trip } from './types';

const trip = (day: string, totalCents: number, storeName = 'Leclerc'): Trip => ({
  id: `${day}-${totalCents}`,
  number: 1,
  day,
  storeId: null,
  storeName,
  totalCents,
  note: '',
  createdAt: '',
});

describe('monthlyTotals', () => {
  it('totalise par mois, les mois sans course comptés à zéro', () => {
    const trips = [trip('2026-07-05', 4000), trip('2026-09-02', 5000), trip('2026-09-20', 2500)];
    expect(monthlyTotals(trips)).toEqual([
      { month: '2026-07', totalCents: 4000, trips: 1 },
      { month: '2026-08', totalCents: 0, trips: 0 },
      { month: '2026-09', totalCents: 7500, trips: 2 },
    ]);
  });

  it('traverse le changement d’année', () => {
    expect(monthlyTotals([trip('2026-12-30', 100), trip('2027-01-02', 200)]).map((m) => m.month)).toEqual([
      '2026-12',
      '2027-01',
    ]);
  });

  it('aucune course : aucun mois', () => {
    expect(monthlyTotals([])).toEqual([]);
  });
});

describe('averageBasket', () => {
  it('arrondi au centime, rien sans course', () => {
    expect(averageBasket([trip('2026-09-01', 1000), trip('2026-09-02', 1001)])).toBe(1001);
    expect(averageBasket([])).toBeNull();
  });
});

describe('byStore', () => {
  it('par magasin, le plus fréquenté d’abord, les courses sans magasin à part', () => {
    const result = byStore([
      trip('2026-09-01', 4000, 'Carrefour'),
      trip('2026-09-02', 5000, 'Leclerc'),
      trip('2026-09-03', 3000, 'Leclerc'),
      trip('2026-09-04', 1000, ''),
    ]);
    expect(result).toEqual([
      { storeName: 'Leclerc', trips: 2, totalCents: 8000, averageCents: 4000 },
      { storeName: 'Carrefour', trips: 1, totalCents: 4000, averageCents: 4000 },
      { storeName: 'Sans magasin', trips: 1, totalCents: 1000, averageCents: 1000 },
    ]);
  });
});

describe('money', () => {
  it('lit les euros tapés à la française, sans flottant', () => {
    expect(parseEurosToCents('2,38')).toBe(238);
    expect(parseEurosToCents('2.3')).toBe(230);
    expect(parseEurosToCents(' 12 € ')).toBe(1200);
    expect(parseEurosToCents('0,1')).toBe(10);
  });

  it('refuse ce qui n’est pas un montant', () => {
    expect(parseEurosToCents('')).toBeNull();
    expect(parseEurosToCents('-2')).toBeNull();
    expect(parseEurosToCents('2,345')).toBeNull();
    expect(parseEurosToCents('abc')).toBeNull();
  });

  it('formate pour un champ et pour l’affichage', () => {
    expect(centsToInput(238)).toBe('2,38');
    expect(formatEuros(123456)).toBe('1 234,56 €');
    expect(formatEuros(5)).toBe('0,05 €');
  });
});
