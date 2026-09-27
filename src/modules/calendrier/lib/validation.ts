/**
 * Validation d'un événement — bibliothèque pure. Les règles sont celles des
 * contraintes de `calendar_events` (migration du 27/09/2026) : une erreur
 * lisible ici plutôt qu'un refus de Postgres, incompréhensible à l'écran.
 */
import type { EventInput, Recurrence } from './types';

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
  return input.recurrence ? validateRecurrence(input.recurrence, input.startDay) : null;
}

export function validateRecurrence(rule: Recurrence, startDay: string): string | null {
  if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 99) {
    return 'L’intervalle de répétition doit être un nombre entier entre 1 et 99.';
  }
  if (rule.byWeekday && rule.byWeekday.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return 'Jours de la semaine invalides.';
  }
  if (rule.freq === 'weekly' && rule.byWeekday && rule.byWeekday.length === 0) {
    return 'Choisis au moins un jour de la semaine.';
  }
  if (rule.until !== undefined && rule.count !== undefined) {
    return 'Une série finit à une date ou après un nombre de fois, pas les deux.';
  }
  if (rule.until !== undefined && (!DAY.test(rule.until) || rule.until < startDay)) {
    return 'La date de fin de la série doit être après son début.';
  }
  if (rule.count !== undefined && (!Number.isInteger(rule.count) || rule.count < 1 || rule.count > 999)) {
    return 'Le nombre de répétitions doit être un nombre entier entre 1 et 999.';
  }
  return null;
}
