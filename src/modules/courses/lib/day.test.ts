import { describe, expect, it } from 'vitest';
import { dayString, formatDay, formatMonth } from './day';

describe('dayString', () => {
  it('le jour local, au format AAAA-MM-JJ', () => {
    expect(dayString(new Date(2026, 8, 5, 23, 30))).toBe('2026-09-05');
  });
});

describe('formatDay', () => {
  it('le jour de la semaine et la date, l’année seulement si elle diffère', () => {
    expect(formatDay('2026-09-25', '2026-09-26')).toBe('vendredi 25 septembre');
    expect(formatDay('2025-12-31', '2026-01-02')).toBe('mercredi 31 décembre 2025');
  });
});

describe('formatMonth', () => {
  it('le mois en toutes lettres', () => {
    expect(formatMonth('2026-09')).toBe('septembre 2026');
  });
});
