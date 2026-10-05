import { describe, expect, it } from 'vitest';
import { dayLabel, dueLabel, shortDate, sinceLabel } from './format';

const TODAY = '2026-10-05'; // un lundi

describe('les dates en français', () => {
  it('la date courte, l’année seulement si elle change', () => {
    expect(shortDate('2026-10-06', TODAY)).toBe('6 oct.');
    expect(shortDate('2026-11-01', TODAY)).toBe('1er nov.');
    expect(shortDate('2027-01-15', TODAY)).toBe('15 janv. 2027');
  });

  it('les jours proches dits simplement', () => {
    expect(dayLabel(TODAY, TODAY)).toBe('aujourd’hui');
    expect(dayLabel('2026-10-06', TODAY)).toBe('demain');
    expect(dayLabel('2026-10-04', TODAY)).toBe('hier');
    expect(dayLabel('2026-10-08', TODAY)).toBe('jeu. 8');
    expect(dayLabel('2026-10-12', TODAY)).toBe('12 oct.');
    expect(dayLabel('2026-10-01', TODAY)).toBe('1er oct.');
  });

  it('l’échéance et l’attente', () => {
    expect(dueLabel(5)).toBe('dans 5 j');
    expect(dueLabel(0)).toBe('aujourd’hui');
    expect(dueLabel(-3)).toBe('dépassée de 3 j');
    expect(sinceLabel(9)).toBe('depuis 9 jours');
    expect(sinceLabel(1)).toBe('depuis hier');
    expect(sinceLabel(0)).toBe('depuis aujourd’hui');
  });
});
