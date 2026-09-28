/**
 * Le pont avec FullCalendar — bibliothèque pure (étape 3). FullCalendar
 * parle en objets `Date` et en fins EXCLUSIVES pour les journées entières ;
 * Éclipse parle en jours et heures locaux (`AAAA-MM-JJ`, `HH:MM`) et en fins
 * INCLUSES. Toutes les conversions passent ici, testées, et jamais par
 * l'UTC : une date affichée à 9 h est lue à 9 h, changement d'heure ou pas.
 */
import type { CalendarMark, CalendarSource, MarkMove } from '../../../core/lib/services';
import { dayString, shiftDay } from '../../../core/lib/day';
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
  /** Un calque ne se déplace que si son module le permet (`movable`) */
  editable?: boolean;
  /** S'étirer : seulement une marque à une heure (une journée entière ne s'étend pas sur plusieurs jours) */
  durationEditable?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  /**
   * `order` : les événements d'Éclipse d'abord, puis les calques dans l'ordre
   * du registre (`eventOrder` de FullCalendar).
   */
  extendedProps:
    | { order: 0; eventId: string; occurrenceDay: string }
    | { order: number; layer: string; detail?: string; sourceId: string; markId: string; checkable: boolean; done: boolean; movable: boolean };
}

export function toCalendarItem(o: Occurrence): CalendarItem {
  return {
    id: `${o.eventId}|${o.occurrenceDay}`,
    title: o.title,
    ...occurrenceRange(o),
    classNames: [`calendrier-event-${o.color}`, ...(o.recurring ? ['calendrier-event-recurring'] : [])],
    extendedProps: { order: 0, eventId: o.eventId, occurrenceDay: o.occurrenceDay },
  };
}

/**
 * Une marque d'un autre module (`core/lib/services.ts`), en élément de
 * FullCalendar : sur la journée entière, en lecture seule, teintée de la
 * couleur de son module.
 */
export function markItem(source: Pick<CalendarSource, 'id' | 'label' | 'color'>, mark: CalendarMark, order: number): CalendarItem {
  // Une marque à une heure se place dans la grille horaire, pour sa durée
  // (une demi-heure si elle n'en dit pas) ; sinon, dans la bande des journées entières.
  const timed = mark.time
    ? { start: `${mark.day}T${mark.time}`, end: minutesAfter(mark.day, mark.time, mark.duration ?? 30), allDay: false }
    : { start: mark.day, end: shiftDay(mark.day, 1), allDay: true };
  const checkable = !!mark.checkable;
  return {
    id: `layer|${source.id}|${mark.id}`,
    // Le rond d'une marque à cocher est dessiné à part (`CalendarView`) : c'est
    // lui, et lui seul, qui coche — le reste de la marque ouvre sa fenêtre.
    title: mark.title,
    ...timed,
    classNames: [
      'calendrier-layer',
      ...(checkable ? ['calendrier-layer-checkable'] : []),
      ...(mark.done ? ['calendrier-layer-done'] : []),
      // Prévisionnelle (la prochaine fois d'une tâche répétée) : en retrait.
      ...(mark.tentative ? ['calendrier-layer-tentative'] : []),
    ],
    editable: !!mark.movable,
    durationEditable: !!mark.movable && !!mark.time,
    // Une teinte légère (alpha 22 %) de la couleur du module, bordée de la couleur pleine.
    backgroundColor: `${source.color}38`,
    borderColor: source.color,
    extendedProps: { order, layer: source.label, detail: mark.detail, sourceId: source.id, markId: mark.id, checkable, done: !!mark.done, movable: !!mark.movable },
  };
}

/** « 2026-09-29T09:30 » pour une marque à 9 h d'une demi-heure — le lendemain si elle passe minuit. */
function minutesAfter(day: string, time: string, duration: number): string {
  const [h, m] = time.split(':').map(Number);
  const minutes = h * 60 + m + duration;
  const next = shiftDay(day, Math.floor(minutes / 1440));
  const t = minutes % 1440;
  return `${next}T${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/**
 * Où une marque a été glissée ou étirée, dans les mots du socle (`MarkMove`) :
 * la journée entière n'a pas d'heure ; la durée n'est dite que si on a étiré
 * la marque — un simple déplacement garde celle de la chose, ou son absence.
 */
export function markMoveFrom(start: Date, end: Date | null, allDay: boolean, resized: boolean): MarkMove {
  if (allDay) return { day: dayString(start), time: null };
  const move: MarkMove = { day: dayString(start), time: timeString(start) };
  if (resized && end) move.duration = Math.round((end.getTime() - start.getTime()) / 60_000);
  return move;
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
