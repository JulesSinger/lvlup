import { describe, expect, it } from 'vitest';
import { expenseForTrip, tripRef } from './budgetLink';

describe('tripRef', () => {
  it('une référence stable, fondée sur le numéro de course et préfixée par le module', () => {
    expect(tripRef({ number: 12 })).toBe('comete:course:12');
  });
});

describe('expenseForTrip', () => {
  it('le total, le jour et le magasin de la course, dans la catégorie Courses', () => {
    expect(expenseForTrip({ number: 3, day: '2026-09-26', storeName: 'Leclerc', totalCents: 4780 })).toEqual({
      ref: 'comete:course:3',
      day: '2026-09-26',
      label: 'Courses — Leclerc',
      amountCents: 4780,
      categoryName: 'Courses',
      note: 'Comète, course n° 3',
    });
  });

  it('sans magasin, un libellé simple', () => {
    expect(expenseForTrip({ number: 1, day: '2026-09-26', storeName: '', totalCents: 100 }).label).toBe('Courses');
  });
});
