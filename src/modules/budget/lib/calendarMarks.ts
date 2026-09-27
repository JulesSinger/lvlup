/**
 * Le calque d'Astra dans le calendrier (Éclipse, docs/etude-calendrier.md
 * §6) — bibliothèque pure : ce qui a été dépensé chaque jour. Les mêmes
 * exclusions que le camembert : un virement interne ou un dépôt d'épargne
 * n'est pas une dépense.
 */
import type { CalendarMark } from '../../../core/lib/services';
import { centsToInputValue } from './amount';
import type { BudgetCategory, BudgetEntry } from './types';

export function spendingMarks(
  entries: readonly BudgetEntry[],
  categories: readonly BudgetCategory[],
  from: string,
  to: string,
): CalendarMark[] {
  const excluded = new Set(categories.filter((c) => c.kind === 'transfert' || c.kind === 'epargne').map((c) => c.id));
  const days = new Map<string, { cents: number; labels: string[] }>();
  for (const e of entries) {
    if (e.day < from || e.day > to || e.amountCents >= 0) continue;
    if (e.categoryId && excluded.has(e.categoryId)) continue;
    if (!days.has(e.day)) days.set(e.day, { cents: 0, labels: [] });
    const day = days.get(e.day)!;
    day.cents += -e.amountCents;
    day.labels.push(`${e.label} (${centsToInputValue(e.amountCents)} €)`);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, { cents, labels }]) => ({
      id: `spent|${day}`,
      day,
      title: `${centsToInputValue(cents)} € dépensés`,
      detail: labels.join(', '),
    }));
}
