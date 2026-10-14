import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { expandEvents } from './recurrence';
import { durationMinutes, parseIcs, readMoment, unescapeText } from './ics';
import type { CalendarEvent, EventException } from './types';
import { validateEvent } from './validation';

// Lire un export du Calendrier d'Apple (docs/etude-calendrier.md §20). Le fichier d'exemple
// reprend la forme d'un vrai export du Mac : fuseau en VTIMEZONE, lignes repliées, alertes,
// occurrences supprimées et déplacées.

const apple = readFileSync(new URL('./__fixtures__/apple.ics', import.meta.url), 'utf8');
const result = parseIcs(apple, 'Europe/Paris', 'vert');
const byTitle = (title: string) => result.events.find((e) => e.event.title === title)!;

describe('lire un fichier .ics', () => {
  it('trouve le nom du calendrier et tous les événements, sauf l’annulé', () => {
    expect(result.calendarName).toBe('Perso');
    expect(result.events.map((e) => e.event.title)).toEqual([
      'Dentiste',
      'Vacances en Bretagne',
      'Yoga',
      'Anniversaire de Léa',
      'Réunion de quartier',
      'Appel avec New York',
      'Payer le loyer',
      'Soirée',
      'Un titre très long qui se replie sur deux lignes dans le fichier exporté par l’app Calendrier du Mac',
    ]);
  });

  it('chaque événement est accepté par les règles d’Atlas', () => {
    for (const e of result.events) expect(validateEvent(e.event)).toBeNull();
  });

  it('un rendez-vous : heures, lieu et note dés-échappés, alertes en rappels, couleur choisie', () => {
    const e = byTitle('Dentiste');
    expect(e.uid).toBe('0A1B2C3D-0001-4000-8000-000000000001');
    expect(e.event).toMatchObject({
      allDay: false,
      startDay: '2026-10-15',
      endDay: '2026-10-15',
      startTime: '14:00',
      endTime: '15:00',
      location: 'Cabinet Dupont, 3 rue des Lilas\nAnnecy',
      note: 'Apporter la radio; et la carte vitale',
      reminders: [30, 120],
      color: 'vert',
      timezone: 'Europe/Paris',
      recurrence: null,
    });
  });

  it('une journée entière sur plusieurs jours : la fin exclusive est ramenée au dernier jour', () => {
    expect(byTitle('Vacances en Bretagne').event).toMatchObject({ allDay: true, startDay: '2026-10-24', endDay: '2026-10-31', startTime: null, reminders: [360] });
  });

  it('une série hebdomadaire, avec une occurrence supprimée et une déplacée', () => {
    const e = byTitle('Yoga');
    expect(e.event.recurrence).toEqual({ freq: 'weekly', interval: 1, until: '2026-12-22' });
    expect(e.exceptions).toEqual([
      { occurrenceDay: '2026-10-20', kind: 'skip' },
      { occurrenceDay: '2026-10-27', kind: 'override', override: { title: 'Yoga (décalé)', startDay: '2026-10-28', endDay: '2026-10-28', startTime: '19:00', endTime: '20:30' } },
    ]);
    // Dépliée comme à l'écran : le 20 n'est pas là, le 27 est au 28 à 19 h.
    const event = { ...e.event, id: 'y', createdAt: '' } as CalendarEvent;
    const exceptions = e.exceptions.map((x, i) => ({ id: `x${i}`, eventId: 'y', createdAt: '', override: x.override ?? null, ...x })) as EventException[];
    const days = expandEvents([event], exceptions, '2026-10-12', '2026-11-01').map((o) => `${o.startDay} ${o.startTime}`);
    expect(days).toEqual(['2026-10-13 18:30', '2026-10-28 19:00']);
  });

  it('un anniversaire tous les ans, depuis 1990', () => {
    expect(byTitle('Anniversaire de Léa').event).toMatchObject({ allDay: true, startDay: '1990-03-15', endDay: '1990-03-15', recurrence: { freq: 'yearly', interval: 1 } });
  });

  it('« le 2e mardi de chaque mois », six fois, à l’heure de Paris', () => {
    expect(byTitle('Réunion de quartier').event).toMatchObject({
      startTime: '09:00',
      endTime: '10:30',
      recurrence: { freq: 'monthly', interval: 1, byNthWeekday: { nth: 2, weekday: 2 }, count: 6 },
    });
  });

  it('un autre fuseau ramené à l’heure de l’appareil ; « aucune alerte » d’Apple ne dit rien', () => {
    expect(byTitle('Appel avec New York').event).toMatchObject({ startDay: '2026-11-20', startTime: '15:00', endTime: '16:00', reminders: [] });
    expect(result.warnings.some((w) => w.includes('New York'))).toBe(false);
  });

  it('une répétition inconnue d’Atlas : importé une fois, et dit', () => {
    expect(byTitle('Payer le loyer').event.recurrence).toBeNull();
    expect(result.warnings.some((w) => w.includes('Payer le loyer') && w.includes('une seule fois'))).toBe(true);
  });

  it('une soirée qui passe minuit, une durée, une alerte à heure fixe laissée de côté', () => {
    expect(byTitle('Soirée').event).toMatchObject({ startDay: '2026-11-03', endDay: '2026-11-04', startTime: '22:00', endTime: '01:00' });
    const long = result.events.at(-1)!;
    expect(long.event).toMatchObject({ startTime: '09:00', endTime: '09:45', reminders: [] });
    expect(result.warnings.some((w) => w.includes('alerte sans équivalent'))).toBe(true);
  });
});

describe('les briques du format', () => {
  it('lit les durées', () => {
    expect(durationMinutes('-PT15M')).toBe(-15);
    expect(durationMinutes('P1D')).toBe(1440);
    expect(durationMinutes('-P1W')).toBe(-10080);
    expect(durationMinutes('PT1H30M')).toBe(90);
    expect(durationMinutes('P')).toBeNull();
    expect(durationMinutes('15 minutes')).toBeNull();
  });

  it('lit les dates et les heures, changement d’heure compris', () => {
    expect(readMoment('20261014', { VALUE: 'DATE' }, 'Europe/Paris')).toEqual({ kind: 'date', day: '2026-10-14' });
    expect(readMoment('20261025T003000Z', {}, 'Europe/Paris')).toEqual({ kind: 'time', day: '2026-10-25', time: '02:30' });
    expect(readMoment('20261026T003000Z', {}, 'Europe/Paris')).toEqual({ kind: 'time', day: '2026-10-26', time: '01:30' });
    expect(readMoment('20261014T090000', {}, 'Europe/Paris')).toEqual({ kind: 'time', day: '2026-10-14', time: '09:00' });
    expect(readMoment('20261014T090000', { TZID: 'Fuseau/Inconnu' }, 'Europe/Paris')).toEqual({ kind: 'time', day: '2026-10-14', time: '09:00' });
    expect(readMoment('n’importe quoi', {}, 'Europe/Paris')).toBeNull();
  });

  it('dés-échappe le texte', () => {
    expect(unescapeText('a\\, b\; c\\nd\\\\e')).toBe('a, b; c\nd\\e');
  });

  it('un fichier vide ou qui n’est pas un calendrier ne donne rien', () => {
    expect(parseIcs('', 'Europe/Paris').events).toEqual([]);
    expect(parseIcs('BEGIN:VCARD\nFN:Léa\nEND:VCARD', 'Europe/Paris').events).toEqual([]);
  });
});
