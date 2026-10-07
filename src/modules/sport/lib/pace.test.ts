import { describe, expect, it } from 'vitest';
import { formatDuration, formatKm, formatPace, formatPaceRange, formatTime } from './format';
import { paceOf, riegel, trainingPaces } from './pace';
import { MARATHON_M } from './types';

describe('dire une distance, un temps, une allure', () => {
  it('en français', () => {
    expect(formatKm(10_210)).toBe('10,2 km');
    expect(formatKm(850)).toBe('850 m');
    expect(formatTime(2832)).toBe('47:12');
    expect(formatTime(3909)).toBe('1:05:09');
    expect(formatDuration(2700)).toBe('45 min');
    expect(formatDuration(3900)).toBe('1 h 05');
    expect(formatPace(330)).toBe('5:30 /km');
    expect(formatPaceRange(320, 340)).toBe('5:20–5:40 /km');
    expect(formatPaceRange(330, 330)).toBe('5:30 /km');
  });
});

describe('allures et prédictions', () => {
  it('l’allure se calcule, et ne dit rien sous 100 m', () => {
    expect(paceOf(10_000, 3000)).toBe(300);
    expect(paceOf(50, 30)).toBeNull();
  });

  it('Riegel : un 10 km en 50 min prédit un semi vers 1 h 50 et un marathon vers 3 h 50', () => {
    expect(riegel(10_000, 3000, 21_098)).toBeGreaterThan(6600);
    expect(riegel(10_000, 3000, 21_098)).toBeLessThan(6650);
    const marathon = riegel(10_000, 3000, MARATHON_M);
    expect(marathon).toBeGreaterThan(3 * 3600 + 45 * 60);
    expect(marathon).toBeLessThan(3 * 3600 + 55 * 60);
  });

  it('les allures d’entraînement se rangent de la plus rapide à la plus lente', () => {
    const p = trainingPaces({ distanceM: 10_000, timeS: 3000 });
    expect(p.fractionne.max).toBeLessThan(p.seuil.max);
    expect(p.seuil.max).toBeLessThan(p.allure.max);
    expect(p.allure.max).toBeLessThan(p.longue.max);
    expect(p.longue.max).toBeLessThan(p.footing.max);
    // L'allure marathon d'un 10 km en 50 min : vers 5:27 /km.
    expect((p.allure.min + p.allure.max) / 2).toBeGreaterThan(320);
    expect((p.allure.min + p.allure.max) / 2).toBeLessThan(335);
    for (const range of Object.values(p)) expect(range.min).toBeLessThanOrEqual(range.max);
  });
});
