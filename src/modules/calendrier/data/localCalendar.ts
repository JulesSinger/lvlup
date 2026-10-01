import { newId } from '../../../core/data/coreStore';
import { readRaw, writeRaw } from '../../../core/data/localSnapshot';
import {
  DEFAULT_CALENDAR_SETTINGS,
  deviceTimezone,
  type CalendarEvent,
  type CalendarSettings,
  type EventException,
  type EventInput,
  type EventOverride,
  type ExceptionKind,
} from '../lib/types';
import type { CalendarBackup, CalendarStore } from './calendarStore';

interface Snapshot extends CalendarBackup {}

const arrayOf = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** Lecture des seules sections du module, sur le blob local partagé. */
function read(): Snapshot {
  const raw = readRaw();
  const settings = raw.calendarSettings && typeof raw.calendarSettings === 'object' ? (raw.calendarSettings as CalendarSettings) : undefined;
  return {
    // Un événement enregistré avant les rappels n'a pas le champ : il suit le défaut.
    events: arrayOf<CalendarEvent>(raw.calendarEvents).map((e) => ({ ...e, reminders: e.reminders ?? null })),
    exceptions: arrayOf<EventException>(raw.calendarExceptions),
    settings,
  };
}

/** Écriture par fusion : les sections des autres modules sont préservées. */
function write(s: Snapshot) {
  writeRaw({
    ...readRaw(),
    calendarEvents: s.events,
    calendarExceptions: s.exceptions,
    ...(s.settings ? { calendarSettings: s.settings } : {}),
  });
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
      reminders: input.reminders ?? null,
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

  async getSettings(): Promise<CalendarSettings> {
    return { ...DEFAULT_CALENDAR_SETTINGS, ...read().settings };
  }

  async saveSettings(patch: Partial<CalendarSettings>) {
    const s = read();
    write({ ...s, settings: { ...DEFAULT_CALENDAR_SETTINGS, ...s.settings, ...patch } });
  }

  async exportData(): Promise<CalendarBackup> {
    const s = read();
    return { events: s.events.slice(), exceptions: s.exceptions.slice(), settings: await this.getSettings() };
  }

  async importData(data: CalendarBackup) {
    // Une sauvegarde d'avant les rappels n'en a pas : on garde le défaut plutôt que d'en inventer.
    const raw = readRaw();
    delete raw.calendarSettings;
    writeRaw(raw);
    write({ events: data.events ?? [], exceptions: data.exceptions ?? [], settings: data.settings });
  }
}
