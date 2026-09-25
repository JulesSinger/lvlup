import { describe, expect, it } from 'vitest';
import type { Entry, Target } from './types';
import { weekDays, weekSummary } from './week';

let seq = 0;
function entry(day: string, kcal: number, proteinDg = 0): Entry {
  seq += 1;
  return {
    id: `e${seq}`,
    day,
    meal: 'lunch',
    foodId: null,
    ciqualCode: '1',
    label: 'x',
    grams: 100,
    kcal,
    proteinDg,
    carbsDg: 0,
    fatDg: 0,
    createdAt: `${day}T12:00:00.000Z`,
  };
}

const target = (effectiveFrom: string, proteinG: number): Target => ({
  id: effectiveFrom,
  effectiveFrom,
  proteinG,
  carbsG: 0,
  fatG: 0,
  createdAt: '',
});

describe('weekDays', () => {
  it('les sept jours qui finissent par le jour donné, du plus ancien au plus récent', () => {
    expect(weekDays('2026-10-02')).toEqual([
      '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02',
    ]);
  });
});

describe('weekSummary', () => {
  const entries = [
    entry('2026-09-25', 1800, 1000),
    entry('2026-09-25', 400, 200),
    entry('2026-09-23', 2000, 800),
    entry('2026-09-10', 9999), // hors de la semaine
  ];

  it('totalise chaque jour et ignore ce qui sort de la semaine', () => {
    const { days } = weekSummary(entries, [], '2026-09-25');
    expect(days.map((d) => d.total.kcal)).toEqual([0, 0, 0, 0, 2000, 0, 2200]);
    expect(days.map((d) => d.logged)).toEqual([false, false, false, false, true, false, true]);
  });

  it('la moyenne ne compte que les jours notés', () => {
    const { average, loggedDays } = weekSummary(entries, [], '2026-09-25');
    expect(loggedDays).toBe(2);
    expect(average).toEqual({ kcal: 2100, proteinDg: 1000, carbsDg: 0, fatDg: 0 });
  });

  it('aucun jour noté : pas de moyenne plutôt qu’une moyenne à zéro', () => {
    expect(weekSummary([], [], '2026-09-25').average).toBeNull();
  });

  it('chaque jour garde l’objectif de son époque', () => {
    const { days } = weekSummary([], [target('2026-09-01', 120), target('2026-09-23', 150)], '2026-09-25');
    expect(days.map((d) => d.target?.proteinG)).toEqual([120, 120, 120, 120, 150, 150, 150]);
  });
});
