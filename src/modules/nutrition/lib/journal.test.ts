import { describe, expect, it } from 'vitest';
import { copyMeal, foodKey, groupByMeal, recentFoods, rescaleEntry, targetForDay, totalOf } from './journal';
import type { Entry, Target } from './types';

let seq = 0;
function entry(overrides: Partial<Entry> = {}): Entry {
  seq += 1;
  return {
    id: `e${seq}`,
    day: '2026-09-25',
    meal: 'breakfast',
    foodId: null,
    ciqualCode: '13039',
    label: 'Pomme, chair et peau, crue',
    grams: 150,
    kcal: 81,
    proteinDg: 5,
    carbsDg: 174,
    fatDg: 5,
    createdAt: `2026-09-25T08:00:${String(seq).padStart(2, '0')}.000Z`,
    ...overrides,
  };
}

describe('groupByMeal', () => {
  it('range chaque entrée sous son repas, dans l’ordre de saisie, les quatre repas toujours présents', () => {
    const late = entry({ meal: 'lunch', createdAt: '2026-09-25T12:30:00.000Z' });
    const early = entry({ meal: 'lunch', createdAt: '2026-09-25T12:00:00.000Z' });
    const groups = groupByMeal([late, early]);
    expect(groups.lunch.map((e) => e.id)).toEqual([early.id, late.id]);
    expect(groups.breakfast).toEqual([]);
    expect(Object.keys(groups)).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
  });
});

describe('totalOf', () => {
  it('additionne les valeurs figées', () => {
    expect(totalOf([entry(), entry()])).toEqual({ kcal: 162, proteinDg: 10, carbsDg: 348, fatDg: 10 });
  });
});

describe('foodKey', () => {
  it('distingue un aliment CIQUAL d’un aliment perso, et rien quand la référence a disparu', () => {
    expect(foodKey({ ciqualCode: '13039', foodId: null })).toBe('ciqual:13039');
    expect(foodKey({ ciqualCode: null, foodId: 'abc' })).toBe('food:abc');
    expect(foodKey({ ciqualCode: null, foodId: null })).toBeNull();
  });
});

describe('recentFoods', () => {
  it('le plus récemment mangé d’abord, avec la quantité de la dernière fois et le nombre de fois', () => {
    const recents = recentFoods([
      entry({ grams: 120, createdAt: '2026-09-20T08:00:00.000Z' }),
      entry({ ciqualCode: '9104', label: 'Riz blanc, cuit', createdAt: '2026-09-22T12:00:00.000Z' }),
      entry({ grams: 180, createdAt: '2026-09-24T08:00:00.000Z' }),
    ]);
    expect(recents.map((r) => [r.key, r.lastGrams, r.count])).toEqual([
      ['ciqual:13039', 180, 2],
      ['ciqual:9104', 150, 1],
    ]);
  });

  it('ignore une entrée dont l’aliment perso a été supprimé', () => {
    expect(recentFoods([entry({ ciqualCode: null, foodId: null })])).toEqual([]);
  });
});

describe('copyMeal', () => {
  it('recopie un seul repas sur un autre jour, valeurs figées comprises, sans id ni date de création', () => {
    const yesterday = [
      entry({ day: '2026-09-24', meal: 'breakfast' }),
      entry({ day: '2026-09-24', meal: 'lunch', label: 'Riz' }),
    ];
    const copies = copyMeal(yesterday, 'breakfast', '2026-09-25');
    expect(copies).toEqual([
      {
        day: '2026-09-25',
        meal: 'breakfast',
        foodId: null,
        ciqualCode: '13039',
        label: 'Pomme, chair et peau, crue',
        grams: 150,
        kcal: 81,
        proteinDg: 5,
        carbsDg: 174,
        fatDg: 5,
      },
    ]);
  });
});

describe('rescaleEntry', () => {
  it('remet les valeurs figées à l’échelle de la nouvelle quantité', () => {
    expect(rescaleEntry(entry(), 300)).toEqual({ grams: 300, kcal: 162, proteinDg: 10, carbsDg: 348, fatDg: 10 });
  });

  it('reste en entiers', () => {
    const v = rescaleEntry(entry(), 100);
    expect(Object.values(v).every(Number.isInteger)).toBe(true);
    expect(v.kcal).toBe(54);
  });
});

describe('targetForDay', () => {
  const target = (effectiveFrom: string, proteinG: number): Target => ({
    id: effectiveFrom,
    effectiveFrom,
    proteinG,
    carbsG: 250,
    fatG: 70,
    createdAt: '2026-09-01T00:00:00.000Z',
  });
  const targets = [target('2026-10-01', 150), target('2026-09-01', 120)];

  it('prend l’objectif le plus récent qui ne dépasse pas le jour', () => {
    expect(targetForDay(targets, '2026-09-30')?.proteinG).toBe(120);
    expect(targetForDay(targets, '2026-10-01')?.proteinG).toBe(150);
    expect(targetForDay(targets, '2026-12-25')?.proteinG).toBe(150);
  });

  it('aucun objectif avant le premier', () => {
    expect(targetForDay(targets, '2026-08-31')).toBeNull();
  });
});
