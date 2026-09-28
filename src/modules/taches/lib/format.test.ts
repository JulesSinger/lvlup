import { describe, expect, it } from 'vitest';
import { dayLabel, dueLabel, durationLabel, shortDate, timeLabel, timeRangeLabel } from './format';

const today = '2026-09-28'; // un lundi

describe('les jours en français', () => {
  it('dayLabel : aujourd’hui, demain, hier, le jour dans la semaine, sinon la date', () => {
    expect(dayLabel(today, today)).toBe('Aujourd’hui');
    expect(dayLabel('2026-09-29', today)).toBe('Demain');
    expect(dayLabel('2026-09-27', today)).toBe('Hier');
    expect(dayLabel('2026-10-02', today)).toBe('vendredi');
    expect(dayLabel('2026-10-05', today)).toBe('lun. 5 oct.');
    expect(dayLabel('2026-09-20', today)).toBe('dim. 20 sept.');
    expect(dayLabel('2027-01-01', today)).toBe('ven. 1er janv. 2027');
  });

  it('shortDate, timeLabel, dueLabel', () => {
    expect(shortDate('2026-10-01', today)).toBe('1er oct.');
    expect(timeLabel('09:00')).toBe('9 h');
    expect(timeLabel('18:30')).toBe('18 h 30');
    expect(dueLabel('2026-09-30', today)).toBe('avant le 30 sept.');
    expect(dueLabel(today, today)).toBe('à faire aujourd’hui');
    expect(dueLabel('2026-09-29', today)).toBe('à faire d’ici demain');
    expect(dueLabel('2026-09-25', today)).toBe('échéance dépassée (25 sept.)');
  });
});

describe('les durées', () => {
  it('durationLabel et timeRangeLabel', () => {
    expect([durationLabel(45), durationLabel(60), durationLabel(90)]).toEqual(['45 min', '1 h', '1 h 30']);
    expect(timeRangeLabel('15:00', 90)).toBe('15 h – 16 h 30');
    expect(timeRangeLabel('15:00', null)).toBe('15 h');
    expect(timeRangeLabel('23:30', 60)).toBe('23 h 30 – 0 h 30');
  });
});
