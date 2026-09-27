import { describe, expect, it } from 'vitest';
import { describeRecurrence } from './describe';
import type { EventInput } from './types';
import { validateEvent } from './validation';

const base: EventInput = {
  title: 'Dentiste',
  allDay: false,
  startDay: '2026-09-29',
  endDay: '2026-09-29',
  startTime: '14:00',
  endTime: '14:30',
};

describe('validateEvent — les règles de la base, en français', () => {
  it('accepte un événement horaire, une journée entière, une soirée qui passe minuit', () => {
    expect(validateEvent(base)).toBeNull();
    expect(validateEvent({ ...base, allDay: true, startTime: null, endTime: null, endDay: '2026-10-04' })).toBeNull();
    expect(validateEvent({ ...base, endDay: '2026-09-30', startTime: '21:00', endTime: '02:00' })).toBeNull();
  });

  it('refuse un titre vide, une fin avant le début, une fin avant l’heure de début le même jour', () => {
    expect(validateEvent({ ...base, title: '  ' })).toMatch(/titre/);
    expect(validateEvent({ ...base, endDay: '2026-09-28' })).toMatch(/avant le début/);
    expect(validateEvent({ ...base, endTime: '13:00' })).toMatch(/après le début/);
    expect(validateEvent({ ...base, endTime: '14:00' })).toMatch(/après le début/);
  });

  it('un horaire exige ses deux heures, bien formées', () => {
    expect(validateEvent({ ...base, endTime: null })).toMatch(/heure/);
    expect(validateEvent({ ...base, startTime: '25:00' })).toMatch(/heure/);
  });

  it('une série : intervalle, jours de semaine, fin par date OU par nombre', () => {
    expect(validateEvent({ ...base, recurrence: { freq: 'weekly', interval: 1, byWeekday: [2, 4] } })).toBeNull();
    expect(validateEvent({ ...base, recurrence: { freq: 'daily', interval: 0 } })).toMatch(/intervalle/);
    expect(validateEvent({ ...base, recurrence: { freq: 'weekly', interval: 1, byWeekday: [] } })).toMatch(/jour de la semaine/);
    expect(validateEvent({ ...base, recurrence: { freq: 'daily', interval: 1, until: '2026-12-31', count: 3 } })).toMatch(/pas les deux/);
    expect(validateEvent({ ...base, recurrence: { freq: 'daily', interval: 1, until: '2026-09-01' } })).toMatch(/après son début/);
    expect(validateEvent({ ...base, recurrence: { freq: 'daily', interval: 1, count: 0 } })).toMatch(/nombre de répétitions/);
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
