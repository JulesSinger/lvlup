import { describe, expect, it } from 'vitest';
import { energyShares, formatDg, gramsForShare, sumValues, targetKcal, valuesForGrams, ZERO } from './macros';

// Pomme crue, pour 100 g (ordre de grandeur CIQUAL).
const apple = { kcal: 53, proteinDg: 3, carbsDg: 113, fatDg: 2 };

describe('valuesForGrams', () => {
  it('ramène les valeurs pour 100 g à la quantité mangée', () => {
    expect(valuesForGrams(apple, 150)).toEqual({ kcal: 80, proteinDg: 5, carbsDg: 170, fatDg: 3 });
  });

  it('100 g rend exactement les valeurs de référence', () => {
    expect(valuesForGrams(apple, 100)).toEqual(apple);
  });

  it('arrondit à l’entier le plus proche, jamais de décimale stockée', () => {
    const v = valuesForGrams({ kcal: 539, proteinDg: 63, carbsDg: 575, fatDg: 309 }, 15);
    expect(v).toEqual({ kcal: 81, proteinDg: 9, carbsDg: 86, fatDg: 46 });
    expect(Object.values(v).every(Number.isInteger)).toBe(true);
  });
});

describe('sumValues', () => {
  it('additionne une journée', () => {
    expect(sumValues([apple, apple, ZERO])).toEqual({ kcal: 106, proteinDg: 6, carbsDg: 226, fatDg: 4 });
  });

  it('une journée vide vaut zéro', () => {
    expect(sumValues([])).toEqual(ZERO);
  });
});

describe('targetKcal', () => {
  it('déduit les kcal des grammes, 4/4/9', () => {
    expect(targetKcal({ proteinG: 140, carbsG: 250, fatG: 70 })).toBe(2190);
  });
});

describe('energyShares', () => {
  it('calcule la part de chaque macro depuis les grammes', () => {
    // 25 g × 4 = 100, 50 g × 4 = 200, 11,1 g × 9 ≈ 100 → 25/50/25
    expect(energyShares({ proteinDg: 250, carbsDg: 500, fatDg: 111 })).toEqual({ protein: 25, carbs: 50, fat: 25 });
  });

  it('la somme fait toujours exactement 100, même quand les parts sont égales', () => {
    // 3 × 400 kcal : 33,33 % chacun
    const shares = energyShares({ proteinDg: 1000, carbsDg: 1000, fatDg: 444 });
    expect(shares.protein + shares.carbs + shares.fat).toBe(100);
  });

  it('un aliment sans énergie donne trois zéros, pas une division par zéro', () => {
    expect(energyShares({ proteinDg: 0, carbsDg: 0, fatDg: 0 })).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });

  it('un aliment 100 % gras donne 100 % de lipides', () => {
    expect(energyShares({ proteinDg: 0, carbsDg: 0, fatDg: 999 })).toEqual({ protein: 0, carbs: 0, fat: 100 });
  });
});

describe('gramsForShare', () => {
  it('convertit un pourcentage d’énergie en grammes (l’exemple de l’étude §2)', () => {
    expect(gramsForShare(2200, 25, 'protein')).toBe(138); // 137,5 arrondi
    expect(gramsForShare(2200, 35, 'fat')).toBe(86);
  });
});

describe('formatDg', () => {
  it('affiche des grammes sans décimale inutile, à la française', () => {
    expect(formatDg(125)).toBe('12,5 g');
    expect(formatDg(120)).toBe('12 g');
    expect(formatDg(0)).toBe('0 g');
  });
});
