import type { Recurrence } from '../../../core/lib/recurrence';

// La règle de récurrence vit dans le socle depuis le 27/09/2026, partagée avec
// Polaris ; réexportée ici parce qu'elle fait partie d'un événement.
export type { Recurrence };

/**
 * Types du module calendrier (Éclipse). Conception complète :
 * docs/etude-calendrier.md.
 *
 * Jours au format `AAAA-MM-JJ`, heures au format `HH:MM`, toujours LOCALES
 * (avec le fuseau à côté) : une récurrence calculée en UTC déplacerait
 * « 9 h » à « 10 h » au changement d'heure (étude §7).
 */

/**
 * Les couleurs d'un événement, par nom plutôt que par code : c'est le thème
 * d'Atlas qui décide de la teinte exacte. Pendant de la contrainte
 * `calendar_events_color_check`, comparé par `lib/schema.test.ts`.
 */
export const EVENT_COLORS = ['bleu', 'vert', 'orange', 'rose', 'violet', 'gris'] as const;
export type EventColor = (typeof EVENT_COLORS)[number];

/** Un événement, ou une série si `recurrence` n'est pas nulle. */
export interface CalendarEvent {
  id: string;
  title: string;
  allDay: boolean;
  startDay: string;
  /** Inclus ; égal à `startDay` pour un événement d'un seul jour */
  endDay: string;
  /** `null` en journée entière */
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  recurrence: Recurrence | null;
  color: EventColor;
  location: string;
  note: string;
  createdAt: string;
}

export type EventInput = Pick<CalendarEvent, 'title' | 'allDay' | 'startDay' | 'endDay' | 'startTime' | 'endTime'> &
  Partial<Pick<CalendarEvent, 'timezone' | 'recurrence' | 'color' | 'location' | 'note'>>;

/** Nature d'une exception — pendant de `calendar_exceptions_kind_check`. */
export const EXCEPTION_KINDS = ['skip', 'override'] as const;
export type ExceptionKind = (typeof EXCEPTION_KINDS)[number];

/** Ce qu'une occurrence modifiée remplace ; le reste vient de la série. */
export type EventOverride = Partial<
  Pick<CalendarEvent, 'title' | 'allDay' | 'startDay' | 'endDay' | 'startTime' | 'endTime' | 'color' | 'location' | 'note'>
>;

/**
 * Une occurrence d'une série supprimée ou modifiée, désignée par le jour
 * qu'elle aurait eu dans la série.
 */
export interface EventException {
  id: string;
  eventId: string;
  occurrenceDay: string;
  kind: ExceptionKind;
  /** Présent si et seulement si `kind === 'override'` */
  override: EventOverride | null;
  createdAt: string;
}

/** Le fuseau par défaut : celui de l'appareil, sinon Paris. */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris';
  } catch {
    return 'Europe/Paris';
  }
}
