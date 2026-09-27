import { describe, expect, it } from 'vitest';
import { describeRecurrence, ruleDays, splitSeries, validateRecurrence, type Recurrence, type Series } from './recurrence';

// Les cas d'Éclipse, repris tels quels au déplacement dans le socle : une
// série commence le mardi 29 septembre 2026.
const event = (overrides: Partial<Series> = {}): Series => ({ startDay: '2026-09-29', recurrence: null, ...overrides });
const series = (recurrence: Recurrence, overrides: Partial<Series> = {}) => event({ recurrence, ...overrides });

describe('ruleDays — les jours d’une série', () => {
  it('un événement ponctuel n’a que son jour', () => {
    expect(ruleDays(event(), '2026-09-01', '2026-09-30')).toEqual(['2026-09-29']);
    expect(ruleDays(event(), '2026-10-01', '2026-10-31')).toEqual([]);
  });

  it('chaque jour, tous les N jours', () => {
    expect(ruleDays(series({ freq: 'daily', interval: 2 }), '2026-09-29', '2026-10-05')).toEqual([
      '2026-09-29',
      '2026-10-01',
      '2026-10-03',
      '2026-10-05',
    ]);
  });

  it('chaque semaine, au jour de début par défaut', () => {
    expect(ruleDays(series({ freq: 'weekly', interval: 1 }), '2026-09-29', '2026-10-20')).toEqual([
      '2026-09-29',
      '2026-10-06',
      '2026-10-13',
      '2026-10-20',
    ]);
  });

  it('certains jours de la semaine, une semaine sur deux, sans rien avant le début', () => {
    // Mardis et jeudis, une semaine sur deux, à partir du mardi 29 septembre.
    const s = series({ freq: 'weekly', interval: 2, byWeekday: [2, 4] });
    expect(ruleDays(s, '2026-09-21', '2026-10-17')).toEqual(['2026-09-29', '2026-10-01', '2026-10-13', '2026-10-15']);
  });

  it('le lundi d’une série commencée un mardi, toutes les deux semaines, suit la semaine de départ', () => {
    // Semaine du 28/09 : le lundi 28 est avant le début, il ne compte pas.
    const s = series({ freq: 'weekly', interval: 2, byWeekday: [1, 2] });
    expect(ruleDays(s, '2026-09-28', '2026-10-13')).toEqual(['2026-09-29', '2026-10-12', '2026-10-13']);
  });

  it('un « 31 de chaque mois » saute les mois qui n’en ont pas', () => {
    const s = series({ freq: 'monthly', interval: 1 }, { startDay: '2026-08-31' });
    expect(ruleDays(s, '2026-08-01', '2027-01-31')).toEqual(['2026-08-31', '2026-10-31', '2026-12-31', '2027-01-31']);
  });

  it('un « 29 février chaque année » n’a lieu que les années bissextiles', () => {
    const s = series({ freq: 'yearly', interval: 1 }, { startDay: '2028-02-29' });
    expect(ruleDays(s, '2028-01-01', '2033-12-31')).toEqual(['2028-02-29', '2032-02-29']);
  });

  it('s’arrête à `until` inclus', () => {
    const s = series({ freq: 'daily', interval: 1, until: '2026-10-01' });
    expect(ruleDays(s, '2026-09-01', '2026-12-31')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01']);
  });

  it('`count` compte depuis le début de la série, même quand la période commence plus tard', () => {
    const s = series({ freq: 'weekly', interval: 1, count: 3 });
    expect(ruleDays(s, '2026-10-10', '2026-12-31')).toEqual(['2026-10-13']);
  });
});

describe('splitSeries — « tous les suivants »', () => {
  it('la série d’origine s’arrête la veille, la suite garde la règle', () => {
    const s = series({ freq: 'weekly', interval: 1, until: '2026-12-31' });
    expect(splitSeries(s, '2026-10-13')).toEqual({
      before: { freq: 'weekly', interval: 1, until: '2026-10-12' },
      after: { freq: 'weekly', interval: 1, until: '2026-12-31' },
    });
  });

  it('une série comptée garde le bon nombre d’occurrences au total', () => {
    const s = series({ freq: 'weekly', interval: 1, count: 5 });
    // Avant le 13 : 29/09 et 06/10 → il en reste 3.
    expect(splitSeries(s, '2026-10-13').after.count).toBe(3);
  });

  it('couper à la toute première occurrence : rien avant', () => {
    expect(splitSeries(series({ freq: 'daily', interval: 1 }), '2026-09-29').before).toBeNull();
  });
});

describe('describeRecurrence — une série en toutes lettres', () => {
  it('dit la fréquence, l’intervalle et les jours, lundi d’abord', () => {
    expect(describeRecurrence({ freq: 'daily', interval: 1 }, '2026-09-29')).toBe('Tous les jours');
    expect(describeRecurrence({ freq: 'weekly', interval: 2, byWeekday: [4, 2] }, '2026-09-29')).toBe(
      'Toutes les 2 semaines le mardi et le jeudi',
    );
    expect(describeRecurrence({ freq: 'weekly', interval: 1, byWeekday: [0, 1, 3] }, '2026-09-29')).toBe(
      'Toutes les semaines le lundi, le mercredi et le dimanche',
    );
  });

  it('au jour de début par défaut, et pour les mois et les années', () => {
    expect(describeRecurrence({ freq: 'weekly', interval: 1 }, '2026-09-29')).toBe('Toutes les semaines le mardi');
    expect(describeRecurrence({ freq: 'monthly', interval: 1 }, '2026-10-01')).toBe('Tous les mois le 1er');
    expect(describeRecurrence({ freq: 'yearly', interval: 1 }, '2026-12-25')).toBe('Tous les ans le 25 décembre');
  });

  it('dit comment la série finit', () => {
    expect(describeRecurrence({ freq: 'daily', interval: 1, until: '2026-12-31' }, '2026-09-29')).toBe(
      'Tous les jours, jusqu’au 31 décembre 2026',
    );
    expect(describeRecurrence({ freq: 'monthly', interval: 3, count: 4 }, '2026-09-29')).toBe('Tous les 3 mois le 29, 4 fois');
  });
});

describe('validateRecurrence — une règle qui a du sens', () => {
  it('intervalle, jours de semaine, fin par date OU par nombre', () => {
    expect(validateRecurrence({ freq: 'weekly', interval: 1, byWeekday: [2, 4] }, '2026-09-29')).toBeNull();
    expect(validateRecurrence({ freq: 'daily', interval: 0 }, '2026-09-29')).toMatch(/intervalle/);
    expect(validateRecurrence({ freq: 'weekly', interval: 1, byWeekday: [] }, '2026-09-29')).toMatch(/jour de la semaine/);
    expect(validateRecurrence({ freq: 'daily', interval: 1, until: '2026-12-31', count: 3 }, '2026-09-29')).toMatch(/pas les deux/);
    expect(validateRecurrence({ freq: 'daily', interval: 1, until: '2026-09-01' }, '2026-09-29')).toMatch(/après son début/);
    expect(validateRecurrence({ freq: 'daily', interval: 1, count: 0 }, '2026-09-29')).toMatch(/nombre de répétitions/);
  });
});
