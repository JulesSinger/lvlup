import { describe, expect, it } from 'vitest';
import { describeRecurrence, isLastOfMonth, isWorkdays, monthlyChoices, nthOfMonth, ruleDays, splitSeries, validateRecurrence, type Recurrence, type Series } from './recurrence';

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

describe('personnaliser davantage (28/09/2026)', () => {
  // Le lundi 28 septembre 2026.
  const from = (recurrence: Recurrence, startDay = '2026-09-28') => ({ startDay, recurrence });

  it('tous les jours sauf le samedi et le dimanche', () => {
    const rule: Recurrence = { freq: 'daily', interval: 1, byWeekday: [1, 2, 3, 4, 5] };
    expect(ruleDays(from(rule), '2026-09-28', '2026-10-06')).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06']);
    expect(describeRecurrence(rule, '2026-09-28')).toBe('Tous les jours sauf le samedi et le dimanche');
  });

  it('tous les jours, seulement certains : décrits par ce qu’on garde', () => {
    const rule: Recurrence = { freq: 'daily', interval: 1, byWeekday: [6, 0] };
    expect(ruleDays(from(rule), '2026-09-28', '2026-10-05')).toEqual(['2026-10-03', '2026-10-04']);
    expect(describeRecurrence(rule, '2026-09-28')).toBe('Tous les jours, seulement le samedi et le dimanche');
  });

  it('un jour du mois par son rang : le 3e mardi, le dernier vendredi', () => {
    const third: Recurrence = { freq: 'monthly', interval: 1, byNthWeekday: { nth: 3, weekday: 2 } };
    expect(ruleDays(from(third), '2026-09-01', '2026-12-31')).toEqual(['2026-10-20', '2026-11-17', '2026-12-15']);
    expect(describeRecurrence(third, '2026-10-20')).toBe('Tous les mois le 3e mardi');
    const last: Recurrence = { freq: 'monthly', interval: 1, byNthWeekday: { nth: -1, weekday: 5 } };
    expect(ruleDays(from(last), '2026-09-28', '2026-12-31')).toEqual(['2026-10-30', '2026-11-27', '2026-12-25']);
    expect(describeRecurrence(last, '2026-10-30')).toBe('Tous les mois le dernier vendredi');
    expect(describeRecurrence({ freq: 'monthly', interval: 2, byNthWeekday: { nth: 1, weekday: 1 } }, '2026-10-05')).toBe('Tous les 2 mois le 1er lundi');
  });

  it('nthOfMonth, isLastOfMonth', () => {
    expect([nthOfMonth('2026-09-15'), nthOfMonth('2026-09-29'), isLastOfMonth('2026-09-29'), isLastOfMonth('2026-09-22')]).toEqual([3, 5, true, false]);
  });

  it('la validation : au moins un jour, et un rang seulement chaque mois', () => {
    expect(validateRecurrence({ freq: 'daily', interval: 1, byWeekday: [] }, '2026-09-28')).toMatch(/au moins un jour/);
    expect(validateRecurrence({ freq: 'weekly', interval: 1, byNthWeekday: { nth: 2, weekday: 2 } }, '2026-09-28')).toMatch(/chaque mois/);
    expect(validateRecurrence({ freq: 'monthly', interval: 1, byNthWeekday: { nth: 5 as never, weekday: 2 } }, '2026-09-28')).toMatch(/invalide/);
    expect(validateRecurrence({ freq: 'monthly', interval: 1, byNthWeekday: { nth: -1, weekday: 5 } }, '2026-09-28')).toBeNull();
  });
});

describe('les choix proposés à l’écran', () => {
  it('monthlyChoices : la date, le rang, et « le dernier » quand c’en est un', () => {
    expect(monthlyChoices('2026-09-15').map((c) => c.label)).toEqual(['le 15 de chaque mois', 'le 3e mardi de chaque mois']);
    expect(monthlyChoices('2026-09-29').map((c) => c.label)).toEqual(['le 29 de chaque mois', 'le dernier mardi de chaque mois']);
    expect(monthlyChoices('2026-09-24').map((c) => c.id)).toEqual(['date', 'nth', 'last']);
  });

  it('isWorkdays', () => {
    expect(isWorkdays({ freq: 'daily', interval: 1, byWeekday: [5, 4, 3, 2, 1] })).toBe(true);
    expect(isWorkdays({ freq: 'daily', interval: 1 })).toBe(false);
    expect(isWorkdays({ freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] })).toBe(false);
  });
});
