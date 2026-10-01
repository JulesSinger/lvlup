/**
 * Validation d'un événement — bibliothèque pure. Les règles sont celles des
 * contraintes de `calendar_events` (migration du 27/09/2026) : une erreur
 * lisible ici plutôt qu'un refus de Postgres, incompréhensible à l'écran.
 */
import { validateRecurrence } from '../../../core/lib/recurrence';
import { MAX_REMINDERS, REMINDER_OFFSETS, type EventInput } from './types';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Rend le message de la première règle enfreinte, ou `null` si tout va bien. */
export function validateEvent(input: EventInput): string | null {
  if (!input.title.trim()) return 'Donne un titre à l’événement.';
  if (input.title.trim().length > 120) return 'Le titre est trop long (120 caractères au plus).';
  if (!DAY.test(input.startDay) || !DAY.test(input.endDay)) return 'Choisis les jours de début et de fin.';
  if (input.endDay < input.startDay) return 'La fin ne peut pas être avant le début.';
  if (!input.allDay) {
    if (!input.startTime || !input.endTime || !TIME.test(input.startTime) || !TIME.test(input.endTime)) {
      return 'Indique une heure de début et une heure de fin.';
    }
    if (input.endDay === input.startDay && input.endTime <= input.startTime) {
      return 'La fin doit être après le début (ou le lendemain, pour une soirée qui passe minuit).';
    }
  }
  const reminders = validateReminders(input.reminders ?? null);
  if (reminders) return reminders;
  return input.recurrence ? validateRecurrence(input.recurrence, input.startDay) : null;
}

/**
 * Deux rappels au plus, différents, pris dans la liste. Que leur sorte
 * convienne (avec une heure, ou en journée entière) n'est volontairement pas
 * vérifié : glisser un rendez-vous dans la bande « Journée » le change de
 * sorte sans passer par la fenêtre. `lib/reminders.ts` écarte alors ceux qui
 * ne conviennent plus, et reprend le défaut.
 */
export function validateReminders(reminders: readonly number[] | null): string | null {
  if (reminders === null) return null;
  if (reminders.length > MAX_REMINDERS) return `${MAX_REMINDERS} rappels au plus.`;
  if (new Set(reminders).size !== reminders.length) return 'Les deux rappels sont identiques.';
  if (reminders.some((r) => !(REMINDER_OFFSETS as readonly number[]).includes(r))) return 'Choisis un rappel dans la liste.';
  return null;
}
