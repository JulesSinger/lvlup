import { describe, expect, it } from 'vitest';
import { daysBetween, mondayOf, monthsBetween, shiftDay, weekday } from './day';

describe('jours du calendrier', () => {
  it('shiftDay traverse mois, années et changements d’heure', () => {
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('2026-03-29', 1)).toBe('2026-03-30'); // passage à l'heure d'été
    expect(shiftDay('2026-10-25', 1)).toBe('2026-10-26'); // passage à l'heure d'hiver
  });

  it('daysBetween compte des jours, pas des heures, même à travers un changement d’heure', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(daysBetween('2026-02-01', '2026-01-01')).toBe(-31);
  });

  it('weekday suit Date.getDay (0 = dimanche)', () => {
    expect(weekday('2026-09-27')).toBe(0);
    expect(weekday('2026-09-29')).toBe(2);
  });

  it('les semaines commencent le lundi', () => {
    expect(mondayOf('2026-09-27')).toBe('2026-09-21'); // un dimanche : lundi précédent
    expect(mondayOf('2026-09-28')).toBe('2026-09-28');
  });

  it('monthsBetween compte les mois calendaires', () => {
    expect(monthsBetween('2026-01-31', '2026-02-01')).toBe(1);
    expect(monthsBetween('2026-11-15', '2027-02-15')).toBe(3);
  });
});
