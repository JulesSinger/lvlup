import { describe, expect, it } from 'vitest';
import { tripMarks } from './calendarMarks';
import type { Trip } from './types';

const trip = (number: number, day: string, storeName: string, totalCents: number, note = '') =>
  ({ id: `t${number}`, number, day, storeId: null, storeName, totalCents, note, createdAt: '' }) as Trip;

describe('tripMarks — le calque de Comète', () => {
  it('une marque par course de la période, magasin et total', () => {
    const marks = tripMarks([trip(3, '2026-10-02', 'Lidl', 5420, 'avec Léa'), trip(2, '2026-09-26', '', 1200), trip(1, '2026-09-01', 'Leclerc', 9000)], '2026-09-21', '2026-10-04');
    expect(marks.map((m) => m.title.replace(/\s/g, ' '))).toEqual(['🛒 Courses · 12,00 €', '🛒 Lidl · 54,20 €']);
    expect(marks[1].detail).toBe('Course n° 3 — avec Léa');
  });
});
