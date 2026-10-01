/**
 * Les rappels d'Éclipse — bibliothèque pure (01/10/2026). Comme Polaris,
 * Éclipse calcule ce qui doit partir dans les semaines qui viennent et le
 * déclare au socle (`coreStore.scheduleReminders`), qui l'envoie à l'heure :
 * le serveur ne sait rien des événements.
 *
 * Deux rappels au plus par événement (décision de Jules), 15 minutes avant
 * par défaut. Une occurrence suit sa série, sauf si on lui en a donné
 * d'autres (« cet événement ») ; une occurrence supprimée ne prévient pas.
 */
import type { ReminderInput } from '../../../core/data/coreStore';
import { daysBetween, dayString, shiftDay } from '../../../core/lib/day';
import { expandEvents, type Occurrence } from './recurrence';
import { ALL_DAY_REMINDERS, TIMED_REMINDERS, type CalendarEvent, type CalendarSettings, type EventException } from './types';

/**
 * Jusqu'où les rappels sont posés à l'avance — plus loin que les 7 jours de
 * Polaris : un rendez-vous se prend souvent des semaines avant. Les
 * occurrences d'une série au-delà sont déclarées à une ouverture suivante.
 */
export const REMINDER_HORIZON_DAYS = 30;

/** Titre et texte d'un rappel : 1000 caractères au plus chacun (table `reminders`). */
const TEXT_MAX = 1000;
const clip = (text: string) => (text.length <= TEXT_MAX ? text : `${text.slice(0, TEXT_MAX - 1).trimEnd()}…`);

/** L'instant d'une heure locale d'un jour donné, changement d'heure compris. */
function localInstant(day: string, time: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

/** « 9 h », « 14 h 30 » */
export function hourLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** Le nom d'un rappel, tel que la fenêtre et les réglages le proposent. */
export function reminderLabel(offset: number): string {
  if (offset === -480) return 'Le jour même à 8 h';
  if (offset === 360) return 'La veille à 18 h';
  if (offset === 0) return 'À l’heure';
  if (offset === 1440) return '1 jour avant';
  if (offset % 60 === 0) return `${offset / 60} h avant`;
  return `${offset} min avant`;
}

/** Les rappels qui s'appliquent vraiment : les siens s'ils conviennent à sa sorte, sinon ceux par défaut. */
export function effectiveReminders(reminders: readonly number[] | null, allDay: boolean, settings: CalendarSettings): number[] {
  const allowed: readonly number[] = allDay ? ALL_DAY_REMINDERS : TIMED_REMINDERS;
  const defaults = allDay ? settings.allDayReminders : settings.timedReminders;
  if (reminders === null) return [...new Set(defaults)];
  // Un choix explicite fait pour l'autre sorte (un rendez-vous glissé en journée
  // entière) ne veut plus rien dire : on reprend le défaut plutôt que de se taire.
  const fitting = reminders.filter((r) => allowed.includes(r));
  if (reminders.length > 0 && fitting.length === 0) return [...new Set(defaults)];
  return [...new Set(fitting)];
}

/** « Aujourd'hui », « Demain », sinon « jeudi 8 octobre » — vu du jour où le rappel part. */
function dayLabel(day: string, from: string): string {
  const gap = daysBetween(from, day);
  if (gap === 0) return 'Aujourd’hui';
  if (gap === 1) return 'Demain';
  const [y, m, d] = day.split('-').map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function bodyOf(o: Occurrence, fireDay: string): string {
  const when = o.allDay
    ? `${dayLabel(o.startDay, fireDay)}, toute la journée`
    : `${dayLabel(o.startDay, fireDay)}, ${hourLabel(o.startTime!)} – ${hourLabel(o.endTime!)}`;
  return clip(o.location ? `${when} · ${o.location}` : when);
}

export function plannedReminders(
  events: readonly CalendarEvent[],
  exceptions: readonly EventException[],
  settings: CalendarSettings,
  now: Date,
  horizonDays = REMINDER_HORIZON_DAYS,
): ReminderInput[] {
  const today = dayString(now);
  // Un jour de plus : « la veille à 18 h » du dernier jour couvert doit pouvoir partir.
  const last = shiftDay(today, horizonDays);
  const reminders: ReminderInput[] = [];

  for (const o of expandEvents(events, exceptions, today, last)) {
    const start = localInstant(o.startDay, o.allDay ? '00:00' : o.startTime!);
    for (const offset of effectiveReminders(o.reminders, o.allDay, settings)) {
      const at = new Date(start.getTime() - offset * 60_000);
      if (at <= now) continue;
      reminders.push({
        ref: `event:${o.eventId}:${o.occurrenceDay}:${offset}`,
        fireAt: at.toISOString(),
        title: clip(o.title),
        body: bodyOf(o, dayString(at)),
        url: '/#/calendrier',
      });
    }
  }

  return reminders.sort((a, b) => a.fireAt.localeCompare(b.fireAt) || a.ref.localeCompare(b.ref));
}
