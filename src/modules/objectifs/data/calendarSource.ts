import type { CalendarSource } from '../../../core/lib/services';
import { checkinMarks } from '../lib/calendarMarks';
import type { GoalsStore } from './goalsStore';

/** Le calque de Zénith que le calendrier affiche (`core/lib/services.ts`). */
export function createCalendarSource(store: GoalsStore): CalendarSource {
  return {
    id: 'objectifs',
    label: 'Objectifs',
    color: '#f2c14e',
    defaultVisible: true,
    async marksBetween(from, to) {
      const [goals, actions, checkins] = await Promise.all([store.listGoals(), store.listActions(), store.listCheckins()]);
      return checkinMarks(goals, actions, checkins, from, to);
    },
  };
}
