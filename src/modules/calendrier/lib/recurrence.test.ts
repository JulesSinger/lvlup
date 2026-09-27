import { describe, expect, it } from 'vitest';
import { expandEvents, occurrenceRange, ruleDays, splitSeries } from './recurrence';
import type { CalendarEvent, EventException, Recurrence } from './types';

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'e1',
    title: 'Sport',
    allDay: false,
    startDay: '2026-09-29', // un mardi
    endDay: '2026-09-29',
    startTime: '09:00',
    endTime: '10:00',
    timezone: 'Europe/Paris',
    recurrence: null,
    color: 'vert',
    location: '',
    note: '',
    createdAt: '',
    ...overrides,
  };
}

const series = (recurrence: Recurrence, overrides: Partial<CalendarEvent> = {}) => event({ recurrence, ...overrides });

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
    const s = series({ freq: 'monthly', interval: 1 }, { startDay: '2026-08-31', endDay: '2026-08-31' });
    expect(ruleDays(s, '2026-08-01', '2027-01-31')).toEqual(['2026-08-31', '2026-10-31', '2026-12-31', '2027-01-31']);
  });

  it('un « 29 février chaque année » n’a lieu que les années bissextiles', () => {
    const s = series({ freq: 'yearly', interval: 1 }, { startDay: '2028-02-29', endDay: '2028-02-29' });
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

describe('expandEvents — ce que l’écran affiche', () => {
  const tuesdays = series({ freq: 'weekly', interval: 1 });

  it('une occurrence supprimée disparaît', () => {
    const skip: EventException = { id: 'x', eventId: 'e1', occurrenceDay: '2026-10-06', kind: 'skip', override: null, createdAt: '' };
    const days = expandEvents([tuesdays], [skip], '2026-09-28', '2026-10-18').map((o) => o.startDay);
    expect(days).toEqual(['2026-09-29', '2026-10-13']);
  });

  it('une occurrence modifiée prend ses nouveaux champs, et le dit', () => {
    const later: EventException = {
      id: 'x',
      eventId: 'e1',
      occurrenceDay: '2026-10-06',
      kind: 'override',
      override: { startTime: '19:00', endTime: '20:00' },
      createdAt: '',
    };
    const [o] = expandEvents([tuesdays], [later], '2026-10-06', '2026-10-06');
    expect(o).toMatchObject({ occurrenceDay: '2026-10-06', startTime: '19:00', modified: true, recurring: true });
  });

  it('une occurrence déplacée depuis hors de la période y apparaît, et quitte son ancien jour', () => {
    // Le mardi 13 déplacé au samedi 10.
    const moved: EventException = {
      id: 'x',
      eventId: 'e1',
      occurrenceDay: '2026-10-13',
      kind: 'override',
      override: { startDay: '2026-10-10', endDay: '2026-10-10' },
      createdAt: '',
    };
    expect(expandEvents([tuesdays], [moved], '2026-10-10', '2026-10-11').map((o) => o.occurrenceDay)).toEqual(['2026-10-13']);
    expect(expandEvents([tuesdays], [moved], '2026-10-13', '2026-10-13')).toEqual([]);
  });

  it('une exception sur un jour qui n’est pas dans la série est ignorée', () => {
    const stray: EventException = {
      id: 'x',
      eventId: 'e1',
      occurrenceDay: '2026-10-07', // un mercredi
      kind: 'override',
      override: { title: 'Fantôme' },
      createdAt: '',
    };
    expect(expandEvents([tuesdays], [stray], '2026-10-01', '2026-10-31').some((o) => o.title === 'Fantôme')).toBe(false);
  });

  it('un événement de plusieurs jours touche une période qui commence après son début', () => {
    const trip = event({ id: 't', title: 'Lisbonne', allDay: true, startTime: null, endTime: null, startDay: '2026-09-28', endDay: '2026-10-03' });
    expect(expandEvents([trip], [], '2026-10-01', '2026-10-31').map((o) => o.title)).toEqual(['Lisbonne']);
  });

  it('une série de plusieurs jours garde sa durée à chaque occurrence', () => {
    const weekend = event({ id: 'w', allDay: true, startTime: null, endTime: null, startDay: '2026-10-03', endDay: '2026-10-04', recurrence: { freq: 'weekly', interval: 1 } });
    const [first, second] = expandEvents([weekend], [], '2026-10-01', '2026-10-12');
    expect([first.startDay, first.endDay, second.startDay, second.endDay]).toEqual(['2026-10-03', '2026-10-04', '2026-10-10', '2026-10-11']);
  });

  it('passer une occurrence en journée entière efface ses heures', () => {
    const x: EventException = { id: 'x', eventId: 'e1', occurrenceDay: '2026-09-29', kind: 'override', override: { allDay: true }, createdAt: '' };
    const [o] = expandEvents([tuesdays], [x], '2026-09-29', '2026-09-29');
    expect([o.allDay, o.startTime, o.endTime]).toEqual([true, null, null]);
  });

  it('trie par jour, journées entières d’abord, puis par heure', () => {
    const lunch = event({ id: 'l', title: 'Déjeuner', startTime: '12:30', endTime: '13:30' });
    const birthday = event({ id: 'b', title: 'Anniversaire', allDay: true, startTime: null, endTime: null });
    const early = event({ id: 'r', title: 'Réveil', startTime: '07:00', endTime: '07:15' });
    expect(expandEvents([lunch, birthday, early], [], '2026-09-29', '2026-09-29').map((o) => o.title)).toEqual([
      'Anniversaire',
      'Réveil',
      'Déjeuner',
    ]);
  });

  it('une série à 9 h reste à 9 h après le passage à l’heure d’hiver (25 octobre)', () => {
    const occurrences = expandEvents([tuesdays], [], '2026-10-20', '2026-11-03');
    expect(occurrences.map((o) => [o.startDay, o.startTime])).toEqual([
      ['2026-10-20', '09:00'],
      ['2026-10-27', '09:00'],
      ['2026-11-03', '09:00'],
    ]);
    expect(occurrenceRange(occurrences[1]).start).toBe('2026-10-27T09:00');
  });
});

describe('occurrenceRange — pour FullCalendar', () => {
  it('journée entière : fin exclusive, le lendemain du dernier jour', () => {
    expect(occurrenceRange({ allDay: true, startDay: '2026-09-28', endDay: '2026-10-03', startTime: null, endTime: null })).toEqual({
      start: '2026-09-28',
      end: '2026-10-04',
      allDay: true,
    });
  });

  it('horaire, y compris à cheval sur minuit', () => {
    expect(occurrenceRange({ allDay: false, startDay: '2026-10-03', endDay: '2026-10-04', startTime: '21:00', endTime: '02:00' })).toEqual({
      start: '2026-10-03T21:00',
      end: '2026-10-04T02:00',
      allDay: false,
    });
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
