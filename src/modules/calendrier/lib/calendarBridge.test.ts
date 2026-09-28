import { describe, expect, it } from 'vitest';
import { defaultSpan, markItem, spanFromRange, spanFromSelection, timeString, toCalendarItem } from './calendarBridge';
import type { Occurrence } from './recurrence';

const at = (day: string, time = '00:00') => {
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
};

const occurrence = (overrides: Partial<Occurrence> = {}): Occurrence => ({
  eventId: 'e1',
  occurrenceDay: '2026-09-29',
  title: 'Dentiste',
  allDay: false,
  startDay: '2026-09-29',
  endDay: '2026-09-29',
  startTime: '14:00',
  endTime: '14:30',
  color: 'bleu',
  location: '',
  note: '',
  recurring: false,
  modified: false,
  ...overrides,
});

describe('toCalendarItem', () => {
  it('une occurrence ponctuelle : dates locales, couleur, déplaçable', () => {
    expect(toCalendarItem(occurrence())).toEqual({
      id: 'e1|2026-09-29',
      title: 'Dentiste',
      start: '2026-09-29T14:00',
      end: '2026-09-29T14:30',
      allDay: false,
      classNames: ['calendrier-event-bleu'],
      extendedProps: { order: 0, eventId: 'e1', occurrenceDay: '2026-09-29' },
    });
  });

  it('une occurrence de série est marquée, et pas encore déplaçable (étape 4)', () => {
    const item = toCalendarItem(occurrence({ recurring: true }));
    expect(item.classNames).toContain('calendrier-event-recurring');
  });
});

describe('spanFromRange', () => {
  it('journée entière : la fin exclusive de FullCalendar devient la veille', () => {
    expect(spanFromRange(at('2026-09-28'), at('2026-10-04'), true)).toEqual({
      allDay: true,
      startDay: '2026-09-28',
      endDay: '2026-10-03',
      startTime: null,
      endTime: null,
    });
  });

  it('horaire, y compris à cheval sur minuit', () => {
    expect(spanFromRange(at('2026-10-03', '21:00'), at('2026-10-04', '02:00'), false)).toEqual({
      allDay: false,
      startDay: '2026-10-03',
      endDay: '2026-10-04',
      startTime: '21:00',
      endTime: '02:00',
    });
  });

  it('sans fin : une heure', () => {
    expect(spanFromRange(at('2026-09-29', '09:30'), null, false)).toMatchObject({ startTime: '09:30', endTime: '10:30' });
  });

  it('lit l’heure locale, même le jour du changement d’heure', () => {
    expect(timeString(at('2026-10-25', '09:00'))).toBe('09:00');
    expect(spanFromRange(at('2026-10-25', '09:00'), at('2026-10-25', '10:00'), false).startTime).toBe('09:00');
  });
});

describe('spanFromSelection', () => {
  it('un simple toucher sur un créneau de 30 minutes devient un rendez-vous d’une heure', () => {
    expect(spanFromSelection(at('2026-09-29', '14:00'), at('2026-09-29', '14:30'), false)).toMatchObject({
      startTime: '14:00',
      endTime: '15:00',
    });
  });

  it('une sélection glissée plus longue est gardée telle quelle', () => {
    expect(spanFromSelection(at('2026-09-29', '14:00'), at('2026-09-29', '16:30'), false)).toMatchObject({
      startTime: '14:00',
      endTime: '16:30',
    });
  });
});

describe('defaultSpan', () => {
  it('à l’heure pleine suivante, pour une heure', () => {
    expect(defaultSpan(at('2026-09-29', '14:20'))).toMatchObject({ startDay: '2026-09-29', startTime: '15:00', endTime: '16:00' });
  });

  it('tard le soir, il passe au lendemain', () => {
    expect(defaultSpan(at('2026-09-29', '23:10'))).toMatchObject({ startDay: '2026-09-30', startTime: '00:00', endTime: '01:00' });
  });
});

describe('markItem — une marque d’un autre module', () => {
  it('journée entière, en lecture seule, teintée de la couleur du module', () => {
    const item = markItem({ id: 'objectifs', label: 'Zénith', color: '#f2c14e' }, { id: 'g|2026-09-27', day: '2026-09-27', title: '✓ Course', detail: 'Marathon' }, 1);
    expect(item).toEqual({
      id: 'layer|objectifs|g|2026-09-27',
      title: '✓ Course',
      start: '2026-09-27',
      end: '2026-09-28',
      allDay: true,
      classNames: ['calendrier-layer'],
      editable: false,
      backgroundColor: '#f2c14e38',
      borderColor: '#f2c14e',
      extendedProps: { order: 1, layer: 'Zénith', detail: 'Marathon', sourceId: 'objectifs', markId: 'g|2026-09-27', checkable: false, done: false },
    });
  });
});

describe('markItem — une marque à cocher, à une heure (Polaris)', () => {
  const polaris = { id: 'taches', label: 'Polaris', color: '#ff9f7a' };

  it('dans la grille horaire pour une demi-heure ; le rond est dessiné à part, pas dans le titre', () => {
    const item = markItem(polaris, { id: 'task:a', day: '2026-09-29', title: 'Garage', time: '09:00', checkable: true, done: false }, 2);
    expect([item.title, item.start, item.end, item.allDay]).toEqual(['Garage', '2026-09-29T09:00', '2026-09-29T09:30', false]);
    expect(item.classNames).toEqual(['calendrier-layer', 'calendrier-layer-checkable']);
    expect(item.extendedProps).toMatchObject({ sourceId: 'taches', markId: 'task:a', checkable: true });
  });

  it('cochée : la classe « faite » et `done` ; à 23 h 45, elle finit le lendemain', () => {
    const item = markItem(polaris, { id: 'task:b', day: '2026-09-29', title: 'Tard', time: '23:45', checkable: true, done: true }, 2);
    expect([item.title, item.end, item.extendedProps]).toEqual(['Tard', '2026-09-30T00:15', expect.objectContaining({ done: true })]);
    expect(item.classNames).toContain('calendrier-layer-done');
  });
});
