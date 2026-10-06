import { describe, expect, it } from 'vitest';
import { agoLabel, axisTicks, daysBetween, shortDay, spanLabel, timePositions } from './chartTime';

describe('chartTime', () => {
  it('compte les jours sans se tromper au changement d’heure', () => {
    expect(daysBetween('2026-10-20', '2026-10-30')).toBe(10);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-01-01', '2025-12-31')).toBe(-1);
  });

  it('place les relevés à leur date, pas à intervalles réguliers', () => {
    // Trois pesées en une semaine, puis une deux mois plus tard.
    const pos = timePositions(['2026-01-01', '2026-01-04', '2026-01-08', '2026-03-02']);
    expect(pos[0]).toBe(0);
    expect(pos[3]).toBe(1);
    expect(pos[2]).toBeCloseTo(7 / 60);
    expect(pos[1]).toBeLessThan(0.1);
  });

  it('un seul jour, ou une liste vide, ne divise pas par zéro', () => {
    expect(timePositions([])).toEqual([]);
    expect(timePositions(['2026-05-01'])).toEqual([0]);
    expect(timePositions(['2026-05-01', '2026-05-01'])).toEqual([0, 0]);
  });

  it('dit la date courte, avec l’année seulement si elle n’est pas celle d’aujourd’hui', () => {
    expect(shortDay('2026-05-12', '2026-10-06')).toBe('12 mai');
    expect(shortDay('2025-12-01', '2026-10-06')).toBe('1 déc. 2025');
  });

  it('dit le temps écoulé', () => {
    expect(agoLabel('2026-10-06', '2026-10-06')).toBe("aujourd'hui");
    expect(agoLabel('2026-10-05', '2026-10-06')).toBe('hier');
    expect(agoLabel('2026-10-01', '2026-10-06')).toBe('il y a 5 jours');
    expect(agoLabel('2026-09-15', '2026-10-06')).toBe('il y a 3 semaines');
    expect(agoLabel('2026-06-06', '2026-10-06')).toBe('il y a 4 mois');
    expect(agoLabel('2024-10-01', '2026-10-06')).toBe('il y a 2 ans');
  });

  it('dit la durée couverte', () => {
    expect(spanLabel('2026-10-06', '2026-10-06')).toBe('le même jour');
    expect(spanLabel('2026-10-01', '2026-10-06')).toBe('sur 6 jours');
    expect(spanLabel('2026-09-01', '2026-10-06')).toBe('sur 5 semaines');
    expect(spanLabel('2026-01-01', '2026-10-06')).toBe('sur 9 mois');
    expect(spanLabel('2024-01-01', '2026-10-06')).toBe('sur 3 ans');
  });

  it('écrit la première et la dernière date, et des repères réguliers dans le temps', () => {
    const days = ['2026-01-01', '2026-01-02', '2026-04-11'];
    expect(axisTicks(days, 2)).toEqual([
      { day: '2026-01-01', at: 0 },
      { day: '2026-04-11', at: 1 },
    ]);
    const ticks = axisTicks(days, 4);
    expect(ticks.map((t) => t.day)).toEqual(['2026-01-01', '2026-02-03', '2026-03-09', '2026-04-11']);
    expect(ticks[1].at).toBeCloseTo(1 / 3, 1);
  });

  it('un seul jour : une seule étiquette', () => {
    expect(axisTicks(['2026-05-01', '2026-05-01'], 4)).toEqual([{ day: '2026-05-01', at: 0 }]);
    expect(axisTicks([], 4)).toEqual([]);
  });

  it('pas de repère intermédiaire sur deux jours consécutifs', () => {
    expect(axisTicks(['2026-05-01', '2026-05-02'], 5).map((t) => t.day)).toEqual(['2026-05-01', '2026-05-02']);
  });
});
