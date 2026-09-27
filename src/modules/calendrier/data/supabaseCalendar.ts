import type { SupabaseClient } from '@supabase/supabase-js';
import { getClient, requireUserId, unwrap } from '../../../core/data/supabaseClient';
import {
  deviceTimezone,
  type CalendarEvent,
  type EventColor,
  type EventException,
  type EventInput,
  type EventOverride,
  type ExceptionKind,
  type Recurrence,
} from '../lib/types';
import type { CalendarBackup, CalendarStore } from './calendarStore';

interface EventRow {
  id: string;
  title: string;
  all_day: boolean;
  start_day: string;
  end_day: string;
  start_time: string | null;
  end_time: string | null;
  timezone: string;
  recurrence: Recurrence | null;
  color: EventColor;
  location: string;
  note: string;
  created_at: string;
}

interface ExceptionRow {
  id: string;
  event_id: string;
  occurrence_day: string;
  kind: ExceptionKind;
  override: EventOverride | null;
  created_at: string;
}

/** Postgres rend une heure « 14:00:00 » ; l'application parle en « 14:00 ». */
const hhmm = (time: string | null) => (time === null ? null : time.slice(0, 5));

const toEvent = (r: EventRow): CalendarEvent => ({
  id: r.id,
  title: r.title,
  allDay: r.all_day,
  startDay: r.start_day,
  endDay: r.end_day,
  startTime: hhmm(r.start_time),
  endTime: hhmm(r.end_time),
  timezone: r.timezone,
  recurrence: r.recurrence,
  color: r.color,
  location: r.location,
  note: r.note,
  createdAt: r.created_at,
});

const toException = (r: ExceptionRow): EventException => ({
  id: r.id,
  eventId: r.event_id,
  occurrenceDay: r.occurrence_day,
  kind: r.kind,
  override: r.override,
  createdAt: r.created_at,
});

/** Colonnes d'un événement, pour les seuls champs présents dans `patch`. */
function eventColumns(patch: Partial<EventInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined) row.title = patch.title;
  if (patch.allDay !== undefined) row.all_day = patch.allDay;
  if (patch.startDay !== undefined) row.start_day = patch.startDay;
  if (patch.endDay !== undefined) row.end_day = patch.endDay;
  if (patch.startTime !== undefined) row.start_time = patch.startTime;
  if (patch.endTime !== undefined) row.end_time = patch.endTime;
  if (patch.timezone !== undefined) row.timezone = patch.timezone;
  if (patch.recurrence !== undefined) row.recurrence = patch.recurrence;
  if (patch.color !== undefined) row.color = patch.color;
  if (patch.location !== undefined) row.location = patch.location;
  if (patch.note !== undefined) row.note = patch.note;
  // Journée entière : pas d'heure, sinon la contrainte de la base refuse.
  if (patch.allDay === true) {
    row.start_time = null;
    row.end_time = null;
  }
  return row;
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Éclipse stockée sur Supabase, protégée par le Row Level Security. */
export class SupabaseCalendar implements CalendarStore {
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = getClient(url, anonKey);
  }

  private requireUserId(): Promise<string> {
    return requireUserId(this.client);
  }

  async listEvents(): Promise<CalendarEvent[]> {
    return (unwrap(await this.client.from('calendar_events').select('*')) as EventRow[]).map(toEvent);
  }

  async createEvent(input: EventInput): Promise<CalendarEvent> {
    const userId = await this.requireUserId();
    const row = unwrap(
      await this.client
        .from('calendar_events')
        .insert({ user_id: userId, timezone: deviceTimezone(), ...eventColumns(input) })
        .select()
        .single(),
    ) as EventRow;
    return toEvent(row);
  }

  async updateEvent(id: string, patch: Partial<EventInput>) {
    check((await this.client.from('calendar_events').update(eventColumns(patch)).eq('id', id)).error);
  }

  async deleteEvent(id: string) {
    // `on delete cascade` emporte les exceptions.
    check((await this.client.from('calendar_events').delete().eq('id', id)).error);
  }

  async listExceptions(): Promise<EventException[]> {
    return (unwrap(await this.client.from('calendar_exceptions').select('*')) as ExceptionRow[]).map(toException);
  }

  async setException(eventId: string, occurrenceDay: string, kind: ExceptionKind, override?: EventOverride) {
    const userId = await this.requireUserId();
    // La contrainte unique (event_id, occurrence_day) fait du remplacement
    // d'une exception une simple mise à jour.
    const row = unwrap(
      await this.client
        .from('calendar_exceptions')
        .upsert(
          {
            user_id: userId,
            event_id: eventId,
            occurrence_day: occurrenceDay,
            kind,
            override: kind === 'override' ? (override ?? {}) : null,
          },
          { onConflict: 'event_id,occurrence_day' },
        )
        .select()
        .single(),
    ) as ExceptionRow;
    return toException(row);
  }

  async deleteException(id: string) {
    check((await this.client.from('calendar_exceptions').delete().eq('id', id)).error);
  }

  async exportData(): Promise<CalendarBackup> {
    return { events: await this.listEvents(), exceptions: await this.listExceptions() };
  }

  /**
   * Remplace tout, comme une restauration de sauvegarde. Les événements
   * changent d'id à l'import : on reconstitue les correspondances avant de
   * réinsérer leurs exceptions.
   */
  async importData(data: CalendarBackup) {
    const userId = await this.requireUserId();
    check((await this.client.from('calendar_exceptions').delete().eq('user_id', userId)).error);
    check((await this.client.from('calendar_events').delete().eq('user_id', userId)).error);

    const ids = new Map<string, string>();
    for (const event of data.events ?? []) {
      const row = unwrap(
        await this.client
          .from('calendar_events')
          .insert({ user_id: userId, ...eventColumns(event) })
          .select('id')
          .single(),
      ) as { id: string };
      ids.set(event.id, row.id);
    }
    for (const x of data.exceptions ?? []) {
      const eventId = ids.get(x.eventId);
      if (!eventId) continue; // série disparue : l'exception n'a plus de sens
      check(
        (
          await this.client.from('calendar_exceptions').insert({
            user_id: userId,
            event_id: eventId,
            occurrence_day: x.occurrenceDay,
            kind: x.kind,
            override: x.override,
          })
        ).error,
      );
    }
  }
}
