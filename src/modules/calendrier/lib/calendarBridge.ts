/**
 * Le pont avec FullCalendar — bibliothèque pure (étape 3). FullCalendar
 * parle en objets `Date` et en fins EXCLUSIVES pour les journées entières ;
 * Éclipse parle en jours et heures locaux (`AAAA-MM-JJ`, `HH:MM`) et en fins
 * INCLUSES. Toutes les conversions passent ici, testées, et jamais par
 * l'UTC : une date affichée à 9 h est lue à 9 h, changement d'heure ou pas.
 */
import { dayString, shiftDay } from './day';
import { occurrenceRange, type Occurrence } from './recurrence';
import type { EventColor, EventInput } from './types';

/** « 09:05 » : l'heure LOCALE d'une date. */
export function timeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Ce que FullCalendar affiche pour une occurrence. */
export interface CalendarItem {
  /** Unique par occurrence : l'événement et son jour dans la série */
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  classNames: string[];
  extendedProps: { eventId: string; occurrenceDay: string };
}

export function toCalendarItem(o: Occurrence): CalendarItem {
  return {
    id: `${o.eventId}|${o.occurrenceDay}`,
    title: o.title,
    ...occurrenceRange(o),
    classNames: [`calendrier-event-${o.color}`, ...(o.recurring ? ['calendrier-event-recurring'] : [])],
    extendedProps: { eventId: o.eventId, occurrenceDay: o.occurrenceDay },
  };
}

/** Les jours et heures d'un événement, sans le reste. */
export type EventSpan = Pick<EventInput, 'allDay' | 'startDay' | 'endDay' | 'startTime' | 'endTime'>;

/**
 * Un intervalle de FullCalendar (sélection, déplacement, étirement) en
 * jours et heures d'Éclipse. Journée entière : la fin de FullCalendar est
 * exclusive, on recule d'un jour. Sans fin (un événement déposé sans
 * durée), on garde celle d'avant, ou une heure.
 */
export function spanFromRange(start: Date, end: Date | null, allDay: boolean): EventSpan {
  if (allDay) {
    const startDay = dayString(start);
    const endDay = end ? shiftDay(dayString(end), -1) : startDay;
    return { allDay: true, startDay, endDay: endDay < startDay ? startDay : endDay, startTime: null, endTime: null };
  }
  const finish = end ?? new Date(start.getTime() + 60 * 60 * 1000);
  return {
    allDay: false,
    startDay: dayString(start),
    endDay: dayString(finish),
    startTime: timeString(start),
    endTime: timeString(finish),
  };
}

/**
 * Une sélection d'un seul créneau (un simple toucher dans la grille
 * horaire, 30 minutes) devient un rendez-vous d'une heure : c'est la durée
 * qu'on attend en touchant « 14 h ». Une sélection plus longue, glissée, est
 * gardée telle quelle.
 */
export function spanFromSelection(start: Date, end: Date, allDay: boolean): EventSpan {
  if (!allDay && end.getTime() - start.getTime() <= 30 * 60 * 1000) {
    return spanFromRange(start, new Date(start.getTime() + 60 * 60 * 1000), false);
  }
  return spanFromRange(start, end, allDay);
}

/** Un nouvel événement proposé depuis le bouton : aujourd'hui, à l'heure pleine suivante, pour une heure. */
export function defaultSpan(now: Date = new Date()): EventSpan {
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  return spanFromRange(start, new Date(start.getTime() + 60 * 60 * 1000), false);
}

/** Les couleurs dans l'ordre proposé à l'écran. */
export const COLOR_LABELS: Record<EventColor, string> = {
  bleu: 'Bleu',
  vert: 'Vert',
  orange: 'Orange',
  rose: 'Rose',
  violet: 'Violet',
  gris: 'Gris',
};
