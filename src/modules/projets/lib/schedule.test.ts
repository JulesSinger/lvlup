import { describe, expect, it } from 'vitest';
import { defaultSchedule } from './schedule';

describe('l’échéancier 30 / 70', () => {
  it('900 € : 270 € à la signature, 630 € à la livraison', () => {
    expect(defaultSchedule(90_000)).toEqual([
      { label: 'Acompte 30 %', amountCents: 27_000, due: 'signature' },
      { label: 'Solde', amountCents: 63_000, due: 'delivery' },
    ]);
  });

  it('les deux paiements font toujours le prix, au centime près', () => {
    for (const price of [1, 99, 123_456, 75_001, 33_333]) {
      const [deposit, rest] = defaultSchedule(price);
      expect(deposit.amountCents + rest.amountCents).toBe(price);
      expect(Number.isInteger(deposit.amountCents)).toBe(true);
    }
  });

  it('sans prix, rien à proposer', () => {
    expect(defaultSchedule(null)).toEqual([]);
    expect(defaultSchedule(0)).toEqual([]);
  });
});
