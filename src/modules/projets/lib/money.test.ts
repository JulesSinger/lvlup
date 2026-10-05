import { describe, expect, it } from 'vitest';
import { centsToInput, formatEuros, parseEuros } from './money';

describe('les montants', () => {
  it('lit un montant tapé à la française', () => {
    expect(parseEuros('900')).toBe(90_000);
    expect(parseEuros('1 234,50')).toBe(123_450);
    expect(parseEuros('1234.5 €')).toBe(123_450);
    expect(parseEuros('0,05')).toBe(5);
    expect(parseEuros('  ')).toBeNull();
    expect(parseEuros('-20')).toBeUndefined();
    expect(parseEuros('12,345')).toBeUndefined();
    expect(parseEuros('douze')).toBeUndefined();
  });

  it('écrit un montant, sans centimes quand ils sont ronds', () => {
    expect(formatEuros(90_000)).toBe('900 €');
    expect(formatEuros(123_456)).toBe('1 234,56 €');
    expect(formatEuros(5)).toBe('0,05 €');
  });

  it('remplit un champ, et la relecture rend le même montant', () => {
    for (const cents of [90_000, 12_345, 5, 100]) expect(parseEuros(centsToInput(cents))).toBe(cents);
    expect(centsToInput(null)).toBe('');
  });
});
