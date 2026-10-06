import { describe, expect, it } from 'vitest';
import { effectiveReminders, hourLabel, plannedReminders, reminderLabel } from './reminders';
import { DEFAULT_CALENDAR_SETTINGS, type CalendarEvent, type EventException } from './types';

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'e1',
    title: 'Dentiste',
    allDay: false,
    startDay: '2026-10-05',
    endDay: '2026-10-05',
    startTime: '14:00',
    endTime: '14:30',
    timezone: 'Europe/Paris',
    recurrence: null,
    color: 'bleu',
    location: '',
    note: '',
    reminders: null,
    createdAt: '',
    ...overrides,
  };
}

/** Lundi 5 octobre 2026, 9 h, heure locale. */
const now = new Date(2026, 9, 5, 9, 0);
const local = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
/** Les tests du calcul gardent un défaut de 15 minutes, pour avoir quelque chose à planifier. */
const WITH_DEFAULT = { timedReminders: [15], allDayReminders: [] };
const plan = (events: CalendarEvent[], exceptions: EventException[] = [], settings = WITH_DEFAULT) =>
  plannedReminders(events, exceptions, settings, now);

describe('plannedReminders', () => {
  it('par défaut, 15 minutes avant un rendez-vous, qui dit quand et où', () => {
    const [r, ...rest] = plan([event({ location: 'Cabinet Martin' })]);
    expect(rest).toEqual([]);
    expect(local(r.fireAt)).toBe('5/10 13:45');
    expect(r).toMatchObject({ title: 'Dentiste', body: 'Aujourd’hui, 14 h – 14 h 30 · Cabinet Martin', url: '/#/calendrier' });
  });

  it('deux rappels choisis, dont la veille', () => {
    const rs = plan([event({ startDay: '2026-10-07', endDay: '2026-10-07', reminders: [1440, 30] })]);
    expect(rs.map((r) => local(r.fireAt))).toEqual(['6/10 14:00', '7/10 13:30']);
    expect(rs[0].body).toBe('Demain, 14 h – 14 h 30');
    expect(new Set(rs.map((r) => r.ref)).size).toBe(2);
  });

  it('« aucun rappel », choisi, ne prévient pas — même avec un défaut', () => {
    expect(plan([event({ reminders: [] })])).toEqual([]);
  });

  it('un rappel déjà passé ne part pas', () => {
    expect(plan([event({ startTime: '09:10', endTime: '10:00' })])).toEqual([]);
  });

  it('en journée entière, rien par défaut ; la veille à 18 h et le jour même à 8 h si on les choisit', () => {
    const day = event({ allDay: true, startTime: null, endTime: null, startDay: '2026-10-08', endDay: '2026-10-08' });
    expect(plan([day])).toEqual([]);
    const rs = plan([{ ...day, reminders: [360, -480] }]);
    expect(rs.map((r) => local(r.fireAt))).toEqual(['7/10 18:00', '8/10 08:00']);
    expect(rs[0].body).toBe('Demain, toute la journée');
    expect(rs[1].body).toBe('Aujourd’hui, toute la journée');
  });

  it('une série : une occurrence par semaine, sauf celle supprimée, et celle déplacée à sa nouvelle heure', () => {
    const weekly = event({ startDay: '2026-10-06', endDay: '2026-10-06', recurrence: { freq: 'weekly', interval: 1 } });
    const exceptions: EventException[] = [
      { id: 'x1', eventId: 'e1', occurrenceDay: '2026-10-13', kind: 'skip', override: null, createdAt: '' },
      { id: 'x2', eventId: 'e1', occurrenceDay: '2026-10-20', kind: 'override', override: { startTime: '18:00', endTime: '19:00' }, createdAt: '' },
    ];
    const rs = plan([weekly], exceptions).map((r) => local(r.fireAt));
    expect(rs.slice(0, 3)).toEqual(['6/10 13:45', '20/10 17:45', '27/10 13:45']);
    expect(rs).not.toContain('13/10 13:45');
  });

  it('une occurrence peut avoir ses propres rappels (« cet événement »)', () => {
    const weekly = event({ startDay: '2026-10-06', endDay: '2026-10-06', recurrence: { freq: 'weekly', interval: 1 } });
    const exceptions: EventException[] = [
      { id: 'x1', eventId: 'e1', occurrenceDay: '2026-10-13', kind: 'override', override: { reminders: [60] }, createdAt: '' },
    ];
    expect(plan([weekly], exceptions).map((r) => local(r.fireAt)).slice(0, 2)).toEqual(['6/10 13:45', '13/10 13:00']);
  });

  it('rien au-delà de trente jours', () => {
    expect(plan([event({ startDay: '2026-11-20', endDay: '2026-11-20' })])).toEqual([]);
    const daily = event({ recurrence: { freq: 'daily', interval: 1 } });
    expect(plan([daily]).length).toBe(31);
  });

  it('le défaut suit les réglages', () => {
    const rs = plan([event()], [], { timedReminders: [5, 60], allDayReminders: [] });
    expect(rs.map((r) => local(r.fireAt))).toEqual(['5/10 13:00', '5/10 13:55']);
  });
});

describe('effectiveReminders', () => {
  it('un rappel « avec une heure » sur une journée entière (glissée dans la bande) reprend le défaut de sa sorte', () => {
    expect(effectiveReminders([15], true, { timedReminders: [15], allDayReminders: [360] })).toEqual([360]);
    expect(effectiveReminders([360], false, WITH_DEFAULT)).toEqual([15]);
  });

  it('garde ce qui convient, sans doublon', () => {
    expect(effectiveReminders([15, 15], false, WITH_DEFAULT)).toEqual([15]);
    // Aucun rappel par défaut (06/10/2026) : un événement qui n'en a pas choisi ne prévient pas.
    expect(effectiveReminders(null, false, DEFAULT_CALENDAR_SETTINGS)).toEqual([]);
    expect(effectiveReminders(null, true, DEFAULT_CALENDAR_SETTINGS)).toEqual([]);
  });
});

describe('les libellés', () => {
  it('des heures et des rappels lisibles', () => {
    expect(hourLabel('09:00')).toBe('9 h');
    expect(hourLabel('14:05')).toBe('14 h 05');
    expect([0, 5, 60, 120, 1440, 360, -480].map(reminderLabel)).toEqual([
      'À l’heure',
      '5 min avant',
      '1 h avant',
      '2 h avant',
      '1 jour avant',
      'La veille à 18 h',
      'Le jour même à 8 h',
    ]);
  });
});
