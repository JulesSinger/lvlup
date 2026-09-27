/**
 * Le calque de Comète dans le calendrier (Éclipse, docs/etude-calendrier.md
 * §6) — bibliothèque pure : les courses faites, magasin et total.
 */
import type { CalendarMark } from '../../../core/lib/services';
import { formatEuros } from './money';
import type { Trip } from './types';

export function tripMarks(trips: readonly Trip[], from: string, to: string): CalendarMark[] {
  return trips
    .filter((t) => t.day >= from && t.day <= to)
    .sort((a, b) => a.day.localeCompare(b.day) || a.number - b.number)
    .map((t) => ({
      id: `trip|${t.number}`,
      day: t.day,
      title: `🛒 ${t.storeName || 'Courses'} · ${formatEuros(t.totalCents)}`,
      detail: t.note ? `Course n° ${t.number} — ${t.note}` : `Course n° ${t.number}`,
    }));
}
