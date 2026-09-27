/**
 * Les occurrences d'Éclipse — bibliothèque pure (docs/etude-calendrier.md
 * §7, §14). On stocke la règle d'une série et ses exceptions ; les
 * occurrences se calculent ici, à l'affichage, et ne sont jamais stockées.
 *
 * La règle elle-même (quels jours, `count`, `until`, couper une série) est
 * le moteur commun du socle (`core/lib/recurrence.ts`) ; ce fichier y ajoute
 * ce qui est propre à un calendrier : la durée d'un événement, ses
 * exceptions, et la traduction pour FullCalendar.
 */
import { daysBetween, shiftDay } from '../../../core/lib/day';
import { ruleDays } from '../../../core/lib/recurrence';
import type { CalendarEvent, EventException, EventOverride } from './types';

/** Une occurrence, telle que l'écran l'affiche. */
export interface Occurrence {
  eventId: string;
  /** Le jour qu'elle a dans la série — c'est lui qui désigne une exception */
  occurrenceDay: string;
  title: string;
  allDay: boolean;
  startDay: string;
  endDay: string;
  startTime: string | null;
  endTime: string | null;
  color: CalendarEvent['color'];
  location: string;
  note: string;
  /** Fait partie d'une série */
  recurring: boolean;
  /** Une occurrence modifiée à part de sa série */
  modified: boolean;
}

/** L'occurrence d'un jour de la série, telle que la règle la donne, sans son exception éventuelle. */
export const baseOccurrence = (event: CalendarEvent, day: string): Occurrence => occurrenceOf(event, day, null);

function occurrenceOf(event: CalendarEvent, day: string, override: EventOverride | null): Occurrence {
  const length = daysBetween(event.startDay, event.endDay);
  const base: Occurrence = {
    eventId: event.id,
    occurrenceDay: day,
    title: event.title,
    allDay: event.allDay,
    startDay: day,
    endDay: shiftDay(day, length),
    startTime: event.startTime,
    endTime: event.endTime,
    color: event.color,
    location: event.location,
    note: event.note,
    recurring: event.recurrence !== null,
    modified: override !== null,
  };
  if (!override) return base;
  const merged = { ...base, ...override };
  // Passer en journée entière efface les heures, comme la contrainte de la base.
  if (merged.allDay) {
    merged.startTime = null;
    merged.endTime = null;
  }
  return merged;
}

/** L'occurrence touche-t-elle la période ? (un événement de plusieurs jours peut commencer avant) */
const overlaps = (o: Occurrence, from: string, to: string) => o.startDay <= to && o.endDay >= from;

/**
 * Toutes les occurrences à afficher entre `from` et `to` (inclus), triées :
 * par jour, les journées entières d'abord, puis par heure.
 *
 * Une occurrence supprimée disparaît ; une occurrence modifiée prend ses
 * nouveaux champs — y compris quand on l'a déplacée d'un jour situé hors de
 * la période vers un jour dedans, ou l'inverse.
 */
export function expandEvents(
  events: readonly CalendarEvent[],
  exceptions: readonly EventException[],
  from: string,
  to: string,
): Occurrence[] {
  const byEvent = new Map<string, Map<string, EventException>>();
  for (const x of exceptions) {
    if (!byEvent.has(x.eventId)) byEvent.set(x.eventId, new Map());
    byEvent.get(x.eventId)!.set(x.occurrenceDay, x);
  }

  const result: Occurrence[] = [];
  for (const event of events) {
    const own = byEvent.get(event.id) ?? new Map<string, EventException>();
    const length = daysBetween(event.startDay, event.endDay);
    // Commencer plus tôt d'autant que dure l'événement : un séjour du 28 au 3
    // touche une période qui commence le 1er.
    const days = new Set(ruleDays(event, shiftDay(from, -length), to));
    // Une occurrence modifiée peut arriver dans la période depuis ailleurs.
    for (const [day, x] of own) {
      if (x.kind === 'override' && !days.has(day) && ruleDays(event, day, day).includes(day)) days.add(day);
    }
    for (const day of days) {
      const x = own.get(day);
      if (x?.kind === 'skip') continue;
      const occurrence = occurrenceOf(event, day, x?.kind === 'override' ? x.override : null);
      if (overlaps(occurrence, from, to)) result.push(occurrence);
    }
  }

  return result.sort(
    (a, b) =>
      a.startDay.localeCompare(b.startDay) ||
      Number(b.allDay) - Number(a.allDay) ||
      (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
      a.title.localeCompare(b.title, 'fr'),
  );
}

/**
 * Ce que FullCalendar attend pour une occurrence : des dates et heures
 * locales « flottantes » (sans fuseau), que l'affichage garde telles
 * quelles. Journée entière : la fin est EXCLUSIVE chez FullCalendar, d'où
 * le jour suivant.
 */
export function occurrenceRange(o: Pick<Occurrence, 'allDay' | 'startDay' | 'endDay' | 'startTime' | 'endTime'>): {
  start: string;
  end: string;
  allDay: boolean;
} {
  if (o.allDay) return { start: o.startDay, end: shiftDay(o.endDay, 1), allDay: true };
  return { start: `${o.startDay}T${o.startTime}`, end: `${o.endDay}T${o.endTime}`, allDay: false };
}
