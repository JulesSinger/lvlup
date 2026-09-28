import type { CalendarSource } from '../../../core/lib/services';
import { spendingMarks } from '../lib/calendarMarks';
import type { BudgetStore } from './budgetStore';

/**
 * Le calque d'Astra que le calendrier affiche (`core/lib/services.ts`).
 * Masqué d'office : un calendrier n'est pas le bon endroit pour lire un
 * budget (étude du calendrier, §6), on l'allume quand on en a besoin.
 */
export function createCalendarSource(store: BudgetStore): CalendarSource {
  return {
    id: 'budget',
    label: 'Budget',
    color: '#9c8cf6',
    defaultVisible: false,
    async marksBetween(from, to) {
      const [entries, categories] = await Promise.all([store.listEntries(), store.listCategories()]);
      return spendingMarks(entries, categories, from, to);
    },
  };
}
