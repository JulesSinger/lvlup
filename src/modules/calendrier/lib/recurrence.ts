/**
 * La récurrence — bibliothèque pure, la règle la plus délicate du module
 * (docs/etude-calendrier.md §3, §7). On stocke la règle d'une série et ses
 * exceptions ; les occurrences se calculent ici, à l'affichage, et ne sont
 * jamais stockées.
 *
 * Le moteur parcourt les jours un à un et demande à chacun « es-tu dans la
 * série ? », plutôt que de sauter d'occurrence en occurrence. Plus lent en
 * théorie, négligeable pour un calendrier personnel, et bien plus facile à
 * rendre juste sur les cas piégeux :
 *  · un « 31 de chaque mois » saute les mois sans 31 (comme la RFC 5545 et
 *    Google Agenda), il ne glisse pas au 30 ;
 *  · un « 29 février chaque année » n'a lieu que les années bissextiles ;
 *  · `count` compte les occurrences de la règle depuis le début, exceptions
 *    comprises : supprimer une occurrence n'en ajoute pas une à la fin.
 *
 * Tout est en jours et heures LOCAUX : une série « tous les mardis à 9 h »
 * reste à 9 h après le changement d'heure, puisqu'aucune heure n'est jamais
 * convertie.
 */
import { daysBetween, maxDay, mondayOf, monthsBetween, shiftDay, weekday } from './day';
import type { CalendarEvent, EventException, EventOverride, Recurrence } from './types';

/** Garde-fou : une série est dépliée au plus sur ce nombre de jours. */
const MAX_SPAN_DAYS = 366 * 30;

/** Le jour appartient-il au motif de la règle ? (sans tenir compte de la fin de série) */
function matches(rule: Recurrence, start: string, day: string): boolean {
  const interval = Math.max(1, rule.interval || 1);
  switch (rule.freq) {
    case 'daily':
      return daysBetween(start, day) % interval === 0;
    case 'weekly': {
      const days = rule.byWeekday && rule.byWeekday.length > 0 ? rule.byWeekday : [weekday(start)];
      if (!days.includes(weekday(day))) return false;
      const weeks = daysBetween(mondayOf(start), mondayOf(day)) / 7;
      return weeks % interval === 0;
    }
    case 'monthly':
      return day.slice(8) === start.slice(8) && monthsBetween(start, day) % interval === 0;
    case 'yearly':
      return day.slice(5) === start.slice(5) && (Number(day.slice(0, 4)) - Number(start.slice(0, 4))) % interval === 0;
  }
}

/**
 * Les jours de début des occurrences d'une série compris entre `from` et
 * `to` (inclus). Un événement ponctuel n'en a qu'un, son jour de début.
 */
export function ruleDays(event: Pick<CalendarEvent, 'startDay' | 'recurrence'>, from: string, to: string): string[] {
  const rule = event.recurrence;
  if (!rule) return event.startDay >= from && event.startDay <= to ? [event.startDay] : [];

  const last = rule.until && rule.until < to ? rule.until : to;
  const days: string[] = [];
  let seen = 0;
  // `count` oblige à compter depuis le début de la série ; sinon, on peut
  // commencer directement à `from`.
  let day = rule.count ? event.startDay : maxDay(event.startDay, from);
  const stop = daysBetween(day, last);
  for (let i = 0; i <= Math.min(stop, MAX_SPAN_DAYS); i++, day = shiftDay(day, 1)) {
    if (!matches(rule, event.startDay, day)) continue;
    seen += 1;
    if (rule.count && seen > rule.count) break;
    if (day >= from) days.push(day);
  }
  return days;
}

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

/**
 * « Tous les suivants » : couper une série au jour `from`. La série
 * d'origine s'arrête la veille ; la suite repart de `from` avec la même
 * règle — et, si la série comptait ses occurrences, avec celles qui restent.
 * Rend `null` pour l'ancienne partie si `from` est la toute première
 * occurrence (il n'y a alors rien avant : on modifie toute la série).
 */
export function splitSeries(
  event: CalendarEvent,
  from: string,
): { before: Recurrence | null; after: Recurrence } {
  const rule = event.recurrence as Recurrence;
  const earlier = ruleDays(event, event.startDay, shiftDay(from, -1)).length;
  const { count: _count, until: _until, ...rest } = rule;
  const before: Recurrence | null = earlier === 0 ? null : { ...rest, until: shiftDay(from, -1) };
  const after: Recurrence = { ...rest };
  if (rule.count) after.count = Math.max(1, rule.count - earlier);
  else if (rule.until) after.until = rule.until;
  return { before, after };
}
