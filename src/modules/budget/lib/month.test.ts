import { describe, expect, test } from 'vitest';
import { currentMonthKey, monthKeyOf, monthLabel, shiftMonthKey } from './month';

describe('monthKeyOf', () => {
  test('extrait AAAA-MM du jour', () => {
    expect(monthKeyOf('2026-07-04')).toBe('2026-07');
    expect(monthKeyOf('2026-12-31')).toBe('2026-12');
  });
});

describe('monthLabel', () => {
  test('rend le nom du mois en français', () => {
    expect(monthLabel('2026-07')).toBe('juillet 2026');
    expect(monthLabel('2026-01')).toBe('janvier 2026');
    expect(monthLabel('2026-12')).toBe('décembre 2026');
  });
});

describe('shiftMonthKey', () => {
  test('avance et recule dans la même année', () => {
    expect(shiftMonthKey('2026-07', 1)).toBe('2026-08');
    expect(shiftMonthKey('2026-07', -1)).toBe('2026-06');
  });

  test('passe le cap de janvier en reculant', () => {
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
  });

  test('passe le cap de décembre en avançant', () => {
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01');
  });

  test('gère un delta de plusieurs mois, y compris à cheval sur deux années', () => {
    expect(shiftMonthKey('2026-11', 3)).toBe('2027-02');
    expect(shiftMonthKey('2026-02', -3)).toBe('2025-11');
  });

  test('un delta de zéro rend le même mois', () => {
    expect(shiftMonthKey('2026-07', 0)).toBe('2026-07');
  });
});

describe('currentMonthKey', () => {
  test('rend un format AAAA-MM', () => {
    expect(currentMonthKey()).toMatch(/^\d{4}-\d{2}$/);
  });
});
