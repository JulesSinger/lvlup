import { describe, expect, it } from 'vitest';
import { targetKcal } from './macros';
import { basalMetabolicRate, estimateTarget, withinAnses, type Profile } from './targets';

const man: Profile = { sex: 'male', age: 30, weightKg: 75, heightCm: 180 };
const woman: Profile = { sex: 'female', age: 30, weightKg: 60, heightCm: 165 };

describe('basalMetabolicRate (Mifflin-St Jeor)', () => {
  it('suit la formule pour un homme', () => {
    // 750 + 1125 − 150 + 5
    expect(basalMetabolicRate(man)).toBe(1730);
  });

  it('suit la formule pour une femme', () => {
    // 600 + 1031,25 − 150 − 161
    expect(basalMetabolicRate(woman)).toBe(1320.25);
  });
});

describe('estimateTarget', () => {
  it('répartit la dépense en grammes : protéines au poids, lipides à 35 %, glucides pour le reste', () => {
    // 1730 × 1,55 = 2681,5 kcal
    const t = estimateTarget(man, 1.55, 'maintain', 1.6);
    expect(t.proteinG).toBe(120); // 75 × 1,6
    expect(t.fatG).toBe(104); // 2681,5 × 35 % / 9
    expect(t.carbsG).toBe(316); // (2681,5 − 480 − 936) / 4 = 316,4
  });

  it('les kcal proposées sont exactement celles des grammes, jamais un autre chiffre', () => {
    const t = estimateTarget(woman, 1.375, 'lose', 2);
    expect(t.kcal).toBe(targetKcal(t));
  });

  it('le but déplace la dépense : perdre < maintenir < prendre', () => {
    const [lose, keep, gain] = (['lose', 'maintain', 'gain'] as const).map(
      (goal) => estimateTarget(man, 1.55, goal, 1.6).kcal,
    );
    expect(lose).toBeLessThan(keep);
    expect(keep).toBeLessThan(gain);
  });

  it('les glucides ne deviennent jamais négatifs, même avec beaucoup de protéines et peu d’énergie', () => {
    const t = estimateTarget({ sex: 'female', age: 80, weightKg: 120, heightCm: 150 }, 1.2, 'lose', 2);
    expect(t.carbsG).toBeGreaterThanOrEqual(0);
  });

  it('tout est en grammes entiers', () => {
    const t = estimateTarget(woman, 1.725, 'gain', 0.83);
    expect([t.proteinG, t.carbsG, t.fatG].every(Number.isInteger)).toBe(true);
  });
});

describe('withinAnses', () => {
  it('compare une part d’énergie aux repères de l’adulte, bornes comprises', () => {
    expect(withinAnses('protein', 20)).toBe(true);
    expect(withinAnses('protein', 21)).toBe(false);
    expect(withinAnses('fat', 34)).toBe(false);
    expect(withinAnses('carbs', 40)).toBe(true);
  });
});
