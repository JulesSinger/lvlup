import type { CalendarEvent, EventException, EventInput, EventOverride, ExceptionKind } from '../lib/types';

/**
 * La part du module dans une sauvegarde. Le socle n'en connaît pas la
 * forme : il se contente d'assembler les sections que les modules lui
 * donnent (voir `core/data/backup.ts`).
 */
export interface CalendarBackup {
  events: CalendarEvent[];
  exceptions: EventException[];
}

/**
 * Contrat de stockage du module calendrier (Éclipse).
 *
 * Il stocke des événements et des séries, jamais des occurrences : les
 * déplier sur une période est le travail de `lib/recurrence.ts` (étape 2),
 * pas du stockage.
 */
export interface CalendarStore {
  /** Tous les événements et séries : leur volume reste petit, et une série commencée il y a longtemps compte encore aujourd'hui. */
  listEvents(): Promise<CalendarEvent[]>;
  createEvent(input: EventInput): Promise<CalendarEvent>;
  updateEvent(id: string, patch: Partial<EventInput>): Promise<void>;
  /** Emporte les exceptions de la série. */
  deleteEvent(id: string): Promise<void>;

  listExceptions(): Promise<EventException[]>;
  /**
   * Pose l'exception d'une occurrence (supprimée ou modifiée). Une seule par
   * jour d'occurrence : en reposer une remplace la précédente.
   */
  setException(eventId: string, occurrenceDay: string, kind: ExceptionKind, override?: EventOverride): Promise<EventException>;
  deleteException(id: string): Promise<void>;

  /** Sa section de la sauvegarde — le socle ne fait que l'assembler. */
  exportData(): Promise<CalendarBackup>;
  importData(data: CalendarBackup): Promise<void>;
}
