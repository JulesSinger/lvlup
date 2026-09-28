import type { CalendarSource } from '../../../core/lib/services';
import { tripMarks } from '../lib/calendarMarks';
import type { CoursesStore } from './coursesStore';

/** Le calque de Comète que le calendrier affiche (`core/lib/services.ts`). */
export function createCalendarSource(store: CoursesStore): CalendarSource {
  return {
    id: 'courses',
    label: 'Courses',
    color: '#6fb6ff',
    defaultVisible: true,
    async marksBetween(from, to) {
      return tripMarks(await store.listTrips(), from, to);
    },
  };
}
