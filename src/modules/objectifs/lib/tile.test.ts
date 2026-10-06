import { describe, expect, it } from 'vitest';
import { goalIdFromHash, hashForGoal, isUntouched, weekStrip } from './tile';
import type { Checkin, Goal } from './types';

const goal = (createdAt: string): Goal =>
  ({ id: 'g', title: 'Courir', description: '', emoji: '🏃', position: 0, archived: false, createdAt, tiers: [] }) as unknown as Goal;
const checkin = (day: string, actionId = 'a'): Checkin =>
  ({ id: `${day}-${actionId}`, goalId: 'g', actionId, pp: 10, day, note: '', createdAt: `${day}T09:00:00.000Z` }) as Checkin;

describe('weekStrip', () => {
  // Mardi 6 octobre 2026.
  const today = '2026-10-06';

  it('rend douze semaines, la dernière contenant aujourd’hui', () => {
    const strip = weekStrip(goal('2026-01-01T00:00:00Z'), [], today);
    expect(strip).toHaveLength(12);
    expect(strip[11].monday).toBe('2026-10-05');
    expect(strip.every((w) => w.inRange && w.days === 0)).toBe(true);
  });

  it('compte des jours, pas des coches : deux actions le même jour font un jour', () => {
    const strip = weekStrip(goal('2026-01-01T00:00:00Z'), [checkin('2026-10-05'), checkin('2026-10-05', 'b'), checkin('2026-10-06'), checkin('2026-09-30')], today);
    expect(strip[11].days).toBe(2);
    expect(strip[10].days).toBe(1);
  });

  it('les semaines d’avant la création ne comptent pas', () => {
    const strip = weekStrip(goal('2026-09-30T08:00:00Z'), [checkin('2026-09-01')], today);
    expect(strip.filter((w) => w.inRange)).toHaveLength(2);
    expect(strip[0]).toMatchObject({ inRange: false, days: 0 });
  });
});

describe('isUntouched', () => {
  it('un objectif sans aucune coche est nouveau', () => {
    expect(isUntouched(goal('2026-10-01'), [])).toBe(true);
    expect(isUntouched(goal('2026-10-01'), [checkin('2026-10-02')])).toBe(false);
  });
});

describe('l’adresse d’un objectif ouvert', () => {
  it('se lit et s’écrit', () => {
    expect(goalIdFromHash(hashForGoal('a b'))).toBe('a b');
    expect(goalIdFromHash('#/objectifs/123')).toBe('123');
    expect(goalIdFromHash('#/objectifs')).toBeNull();
    expect(goalIdFromHash('#/budget/123')).toBeNull();
    expect(goalIdFromHash('#access_token=x')).toBeNull();
  });
});
