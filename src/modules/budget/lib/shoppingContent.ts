/**
 * Le contenu des courses d'une part du budget — bibliothèque pure
 * (docs/etude-courses-typologies.md §4). Budget ne connaît pas les
 * typologies : elles viennent du service `shoppingSpend` (Courses), qui les
 * décrit. Ici, on additionne et on dit ce qui reste sans ticket.
 */
import type { ShoppingSpendService, ShoppingSpendTrip } from '../../../core/lib/services';
import type { BudgetEntry } from './types';

export interface ContentRow {
  id: string;
  label: string;
  emoji: string;
  /** Dépensé, en centimes positifs */
  cents: number;
  /** Le second niveau (alimentation : essentiel, plaisir, alcool), ceux à zéro omis */
  kinds: { id: string; label: string; cents: number }[];
}

export interface ShoppingContent {
  rows: ContentRow[];
  /** Ce que les courses détaillées ont coûté, au total (somme des tickets) */
  detailedCents: number;
  /** Remises en bas de ticket (négatif) */
  adjustmentCents: number;
  /** Dans des courses détaillées, la part que des lignes sans prix laissent sans détail */
  unpricedCents: number;
  /** Les dépenses de la part qui ne viennent pas d'une course détaillée (relevé, saisie) */
  withoutTicketCents: number;
}

type Labels = Pick<ShoppingSpendService, 'typologies' | 'foodTypology' | 'foodKinds'>;

export function shoppingContent(entries: readonly BudgetEntry[], trips: readonly ShoppingSpendTrip[], labels: Labels): ShoppingContent {
  const byKey = new Map<string, number>();
  let adjustmentCents = 0;
  let unpricedCents = 0;
  let detailedCents = 0;
  const refs = new Set(trips.map((t) => t.ref));
  for (const t of trips) {
    for (const [k, v] of Object.entries(t.byKey)) byKey.set(k, (byKey.get(k) ?? 0) + v);
    adjustmentCents += t.adjustmentCents;
    unpricedCents += t.undetailedCents;
  }
  for (const e of entries) if (e.importKey && refs.has(e.importKey)) detailedCents += -e.amountCents;
  const withoutTicketCents = entries.filter((e) => !(e.importKey && refs.has(e.importKey))).reduce((s, e) => s - e.amountCents, 0);

  const rows = labels.typologies
    .map((t) => {
      const kinds = t.id === labels.foodTypology
        ? labels.foodKinds.map((k) => ({ id: k.id, label: k.label, cents: byKey.get(`${t.id}:${k.id}`) ?? 0 })).filter((k) => k.cents !== 0)
        : [];
      return { id: t.id, label: t.label, emoji: t.emoji, cents: (byKey.get(t.id) ?? 0) + kinds.reduce((s, k) => s + k.cents, 0), kinds };
    })
    .filter((r) => r.cents !== 0)
    .sort((a, b) => b.cents - a.cents);
  return { rows, detailedCents, adjustmentCents, unpricedCents, withoutTicketCents };
}

/** Les références que le service peut reconnaître : celles des dépenses créées par un module. */
export const moduleRefs = (entries: readonly BudgetEntry[]) =>
  [...new Set(entries.filter((e) => e.source === 'manuelle' && e.importKey).map((e) => e.importKey as string))];

/**
 * Mois après mois, ce qu'une typologie (`alimentation`) ou un sous-type
 * (`alimentation:plaisir`) a coûté dans les courses détaillées, de la
 * première course jusqu'au mois en cours — les mois sans course à zéro.
 */
export function shoppingTrend(trips: readonly ShoppingSpendTrip[], key: string, todayMonthKey: string): { monthKey: string; cents: number }[] {
  const months = trips.map((t) => t.day.slice(0, 7)).filter((m) => m <= todayMonthKey).sort();
  if (months.length === 0) return [];
  const byMonth = new Map<string, number>();
  for (const t of trips) {
    const month = t.day.slice(0, 7);
    const cents = Object.entries(t.byKey)
      .filter(([k]) => k === key || (!key.includes(':') && k.startsWith(`${key}:`)))
      .reduce((s, [, v]) => s + v, 0);
    byMonth.set(month, (byMonth.get(month) ?? 0) + cents);
  }
  const result: { monthKey: string; cents: number }[] = [];
  let [y, m] = months[0].split('-').map(Number);
  for (;;) {
    const monthKey = `${y}-${String(m).padStart(2, '0')}`;
    if (monthKey > todayMonthKey) break;
    result.push({ monthKey, cents: byMonth.get(monthKey) ?? 0 });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return result;
}
