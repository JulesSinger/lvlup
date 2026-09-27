import { newId } from '../../../core/data/coreStore';
import { readRaw, writeRaw } from '../../../core/data/localSnapshot';
import { deviceTimezone, type CalendarEvent, type EventException, type EventInput, type EventOverride, type ExceptionKind } from '../lib/types';
import type { CalendarBackup, CalendarStore } from './calendarStore';

interface Snapshot extends CalendarBackup {}

const arrayOf = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** Lecture des seules sections du module, sur le blob local partagé. */
function read(): Snapshot {
  const raw = readRaw();
  return {
    events: arrayOf<CalendarEvent>(raw.calendarEvents),
    exceptions: arrayOf<EventException>(raw.calendarExceptions),
  };
}

/** Écriture par fusion : les sections des autres modules sont préservées. */
function write(s: Snapshot) {
  writeRaw({ ...readRaw(), calendarEvents: s.events, calendarExceptions: s.exceptions });
}

/** Éclipse stockée dans le navigateur, sans compte ni serveur. */
export class LocalCalendar implements CalendarStore {
  async listEvents(): Promise<CalendarEvent[]> {
    return read().events.slice();
  }

  async createEvent(input: EventInput): Promise<CalendarEvent> {
    const s = read();
    const event: CalendarEvent = {
      id: newId(),
      title: input.title,
      allDay: input.allDay,
      startDay: input.startDay,
      endDay: input.endDay,
      // Journée entière : pas d'heure, comme la contrainte côté base.
      startTime: input.allDay ? null : input.startTime,
      endTime: input.allDay ? null : input.endTime,
      timezone: input.timezone ?? deviceTimezone(),
      recurrence: input.recurrence ?? null,
      color: input.color ?? 'bleu',
      location: input.location ?? '',
      note: input.note ?? '',
      createdAt: new Date().toISOString(),
    };
    s.events.push(event);
    write(s);
    return event;
  }

  async updateEvent(id: string, patch: Partial<EventInput>) {
    const s = read();
    const event = s.events.find((e) => e.id === id);
    if (!event) return;
    Object.assign(event, patch);
    if (event.allDay) {
      event.startTime = null;
      event.endTime = null;
    }
    write(s);
  }

  async deleteEvent(id: string) {
    const s = read();
    s.events = s.events.filter((e) => e.id !== id);
    s.exceptions = s.exceptions.filter((x) => x.eventId !== id);
    write(s);
  }

  async listExceptions(): Promise<EventException[]> {
    return read().exceptions.slice();
  }

  async setException(eventId: string, occurrenceDay: string, kind: ExceptionKind, override?: EventOverride) {
    const s = read();
    // Une seule exception par occurrence, comme la contrainte unique côté base.
    s.exceptions = s.exceptions.filter((x) => !(x.eventId === eventId && x.occurrenceDay === occurrenceDay));
    const exception: EventException = {
      id: newId(),
      eventId,
      occurrenceDay,
      kind,
      override: kind === 'override' ? (override ?? {}) : null,
      createdAt: new Date().toISOString(),
    };
    s.exceptions.push(exception);
    write(s);
    return exception;
  }

  async deleteException(id: string) {
    const s = read();
    s.exceptions = s.exceptions.filter((x) => x.id !== id);
    write(s);
  }

  async exportData(): Promise<CalendarBackup> {
    const s = read();
    return { events: s.events.slice(), exceptions: s.exceptions.slice() };
  }

  async importData(data: CalendarBackup) {
    write({ events: data.events ?? [], exceptions: data.exceptions ?? [] });
  }
}
