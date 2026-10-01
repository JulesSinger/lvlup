import { describe, expect, it } from 'vitest';
import { expandEvents } from './recurrence';
import { planDelete, planEdit, sameRule, type OccurrenceValues } from './seriesEdit';
import type { CalendarEvent, EventException, EventInput } from './types';

// Tous les mardis à 9 h, à partir du mardi 29 septembre 2026.
const series: CalendarEvent = {
  id: 's',
  title: 'Sport',
  allDay: false,
  startDay: '2026-09-29',
  endDay: '2026-09-29',
  startTime: '09:00',
  endTime: '10:00',
  timezone: 'Europe/Paris',
  recurrence: { freq: 'weekly', interval: 1 },
  color: 'vert',
  location: 'Salle',
  note: '',
  reminders: null,
  createdAt: '',
};

/** Ce que la fenêtre affiche pour l'occurrence d'un jour. */
function shown(day: string, exceptions: EventException[] = [], event = series): OccurrenceValues {
  const o = expandEvents([event], exceptions, day, day).find((x) => x.occurrenceDay === day)!;
  const { title, allDay, startDay, endDay, startTime, endTime, color, location, note, reminders } = o;
  return { title, allDay, startDay, endDay, startTime, endTime, color, location, note, reminders };
}

const edited = (values: OccurrenceValues, changes: Partial<EventInput>, event = series): EventInput => ({
  ...values,
  recurrence: event.recurrence,
  ...changes,
});

const exception = (occurrenceDay: string, override: EventException['override'], id = `x-${occurrenceDay}`): EventException => ({
  id,
  eventId: 's',
  occurrenceDay,
  kind: override ? 'override' : 'skip',
  override,
  createdAt: '',
});

describe('planEdit — cet événement', () => {
  it('ne garde dans l’exception que ce qui diffère de la règle', () => {
    const before = shown('2026-10-06');
    const plan = planEdit(series, [], '2026-10-06', before, edited(before, { startTime: '18:00', endTime: '19:00' }), 'this');
    expect(plan.setException).toEqual({
      eventId: 's',
      occurrenceDay: '2026-10-06',
      kind: 'override',
      override: { startTime: '18:00', endTime: '19:00' },
    });
    expect(plan.update).toBeUndefined();
  });

  it('des rappels à part pour cette seule occurrence (01/10/2026)', () => {
    const before = shown('2026-10-06');
    const plan = planEdit(series, [], '2026-10-06', before, edited(before, { reminders: [60, 1440] }), 'this');
    expect(plan.setException?.override).toEqual({ reminders: [60, 1440] });
  });

  it('les mêmes rappels, dans une nouvelle liste, ne sont pas un changement', () => {
    const withReminders = { ...series, reminders: [15] };
    const before = shown('2026-10-06', [], withReminders);
    const plan = planEdit(withReminders, [], '2026-10-06', before, edited(before, { reminders: [15] }, withReminders), 'this');
    expect(plan).toEqual({ deleteExceptions: [] });
  });

  it('remplace une exception précédente plutôt que de s’y ajouter', () => {
    const earlier = exception('2026-10-06', { startTime: '18:00', endTime: '19:00' });
    const before = shown('2026-10-06', [earlier]);
    const plan = planEdit(series, [earlier], '2026-10-06', before, edited(before, { title: 'Sport léger' }), 'this');
    expect(plan.setException?.override).toEqual({ title: 'Sport léger', startTime: '18:00', endTime: '19:00' });
  });

  it('revenir exactement à la règle retire l’exception', () => {
    const earlier = exception('2026-10-06', { title: 'Sport léger' });
    const before = shown('2026-10-06', [earlier]);
    const plan = planEdit(series, [earlier], '2026-10-06', before, edited(before, { title: 'Sport' }), 'this');
    expect(plan).toEqual({ deleteExceptions: [earlier.id] });
  });

  it('déplacer une occurrence la change de jour, pas la série', () => {
    const before = shown('2026-10-06');
    const plan = planEdit(series, [], '2026-10-06', before, edited(before, { startDay: '2026-10-08', endDay: '2026-10-08' }), 'this');
    expect(plan.setException?.override).toEqual({ startDay: '2026-10-08', endDay: '2026-10-08' });
  });

  it('refuse une occurrence sans cohérence', () => {
    const before = shown('2026-10-06');
    expect(() => planEdit(series, [], '2026-10-06', before, edited(before, { endTime: '08:00' }), 'this')).toThrow(/après le début/);
  });
});

describe('planEdit — tous les événements', () => {
  it('n’applique à la série que ce qui a changé', () => {
    // L'occurrence du 6 était déplacée à 18 h ; on ne change que le titre.
    const earlier = exception('2026-10-06', { startTime: '18:00', endTime: '19:00' });
    const before = shown('2026-10-06', [earlier]);
    const plan = planEdit(series, [earlier], '2026-10-06', before, edited(before, { title: 'Course à pied' }), 'all');
    expect(plan.update).toEqual({ id: 's', patch: { title: 'Course à pied' } });
    expect(plan.deleteExceptions).toEqual([]);
  });

  it('changer les rappels les change pour toute la série, rien d’autre', () => {
    const before = shown('2026-10-06');
    const plan = planEdit(series, [], '2026-10-06', before, edited(before, { reminders: [] }), 'all');
    expect(plan.update).toEqual({ id: 's', patch: { reminders: [] } });
  });

  it('décaler une occurrence d’un jour décale toute la série, et oublie ses exceptions', () => {
    const skip = exception('2026-10-13', null);
    const before = shown('2026-10-06', [skip]);
    const plan = planEdit(series, [skip], '2026-10-06', before, edited(before, { startDay: '2026-10-07', endDay: '2026-10-07' }), 'all');
    expect(plan.update?.patch).toEqual({ startDay: '2026-09-30', endDay: '2026-09-30' });
    expect(plan.deleteExceptions).toEqual([skip.id]);
  });

  it('changer la règle la remplace', () => {
    const before = shown('2026-10-06');
    const rule = { freq: 'weekly' as const, interval: 2, byWeekday: [2, 4] };
    const plan = planEdit(series, [], '2026-10-06', before, edited(before, { recurrence: rule }), 'all');
    expect(plan.update?.patch).toEqual({ recurrence: rule });
  });

  it('ne plus répéter fait de la série un événement unique', () => {
    const before = shown('2026-09-29');
    const plan = planEdit(series, [], '2026-09-29', before, edited(before, { recurrence: null }), 'all');
    expect(plan.update?.patch).toEqual({ recurrence: null });
  });
});

describe('planEdit — cet événement et les suivants', () => {
  it('coupe la série la veille et en crée une nouvelle avec les changements', () => {
    const later = exception('2026-10-20', null);
    const earlier = exception('2026-10-06', { title: 'Sport léger' });
    const before = shown('2026-10-13');
    const plan = planEdit(series, [earlier, later], '2026-10-13', before, edited(before, { startTime: '07:00', endTime: '08:00' }), 'following');
    expect(plan.update).toEqual({ id: 's', patch: { recurrence: { freq: 'weekly', interval: 1, until: '2026-10-12' } } });
    expect(plan.create).toMatchObject({
      title: 'Sport',
      startDay: '2026-10-13',
      endDay: '2026-10-13',
      startTime: '07:00',
      endTime: '08:00',
      location: 'Salle',
      recurrence: { freq: 'weekly', interval: 1 },
    });
    // Les exceptions d'avant la coupure restent ; celles d'après n'ont plus de série.
    expect(plan.deleteExceptions).toEqual([later.id]);
  });

  it('une série comptée garde le bon nombre d’occurrences au total', () => {
    const counted = { ...series, recurrence: { freq: 'weekly' as const, interval: 1, count: 5 } };
    const before = shown('2026-10-13', [], counted);
    const plan = planEdit(counted, [], '2026-10-13', before, edited(before, { title: 'Yoga' }, counted), 'following');
    expect(plan.create?.recurrence).toEqual({ freq: 'weekly', interval: 1, count: 3 });
  });

  it('une nouvelle règle vaut pour la nouvelle série', () => {
    const before = shown('2026-10-13');
    const plan = planEdit(series, [], '2026-10-13', before, edited(before, { recurrence: { freq: 'daily', interval: 1 } }), 'following');
    expect(plan.create?.recurrence).toEqual({ freq: 'daily', interval: 1 });
  });

  it('depuis la toute première occurrence, c’est toute la série', () => {
    const before = shown('2026-09-29');
    const plan = planEdit(series, [], '2026-09-29', before, edited(before, { title: 'Yoga' }), 'following');
    expect(plan.create).toBeUndefined();
    expect(plan.update).toEqual({ id: 's', patch: { title: 'Yoga' } });
  });
});

describe('planDelete', () => {
  it('cet événement : une exception « supprimée »', () => {
    expect(planDelete(series, [], '2026-10-06', 'this')).toEqual({
      setException: { eventId: 's', occurrenceDay: '2026-10-06', kind: 'skip' },
      deleteExceptions: [],
    });
  });

  it('les suivants : la série s’arrête la veille', () => {
    const later = exception('2026-10-20', null);
    expect(planDelete(series, [later], '2026-10-13', 'following')).toEqual({
      update: { id: 's', patch: { recurrence: { freq: 'weekly', interval: 1, until: '2026-10-12' } } },
      deleteExceptions: [later.id],
    });
  });

  it('les suivants depuis la première, ou tous : la série disparaît', () => {
    expect(planDelete(series, [], '2026-09-29', 'following').deleteEvent).toBe('s');
    expect(planDelete(series, [], '2026-10-13', 'all').deleteEvent).toBe('s');
  });
});

describe('sameRule', () => {
  it('ignore l’ordre des jours et les champs vides', () => {
    expect(sameRule({ freq: 'weekly', interval: 1, byWeekday: [4, 2] }, { freq: 'weekly', interval: 1, byWeekday: [2, 4], until: undefined })).toBe(true);
    expect(sameRule({ freq: 'weekly', interval: 1, byWeekday: [] }, { freq: 'weekly', interval: 1 })).toBe(true);
    expect(sameRule({ freq: 'weekly', interval: 1 }, { freq: 'weekly', interval: 2 })).toBe(false);
    expect(sameRule(null, undefined)).toBe(true);
  });
});
