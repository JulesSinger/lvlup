import type { CalendarSource } from '../../../core/lib/services';
import { anniversaryMarks } from '../lib/anniversaries';
import type { HautsFaitsStore } from './hautsFaitsStore';

/**
 * Le calque de Hauts faits dans Calendar (docs/etude-hauts-faits.md §7) :
 * l'anniversaire de chaque haut fait daté au jour. Masqué d'office, comme
 * Budget : on l'allume quand on veut le voir. Lecture seule ; toucher une
 * marque ouvre le haut fait (`feat:<id>`).
 */
export function createCalendarSource(store: HautsFaitsStore): CalendarSource {
  return {
    id: 'hautsfaits',
    label: 'Hauts faits',
    color: '#ee88b2',
    defaultVisible: false,
    async marksBetween(from, to) {
      return anniversaryMarks(await store.listFeats(), from, to);
    },
  };
}
