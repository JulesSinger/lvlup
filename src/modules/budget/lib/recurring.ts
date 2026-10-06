/**
 * Les abonnements et dépenses récurrentes, repérés tout seuls — bibliothèque
 * pure (piste mise de côté le 06/09/2026, docs/etude-astra.md §12, demandée
 * le 2026-10-07).
 *
 * Rien n'est saisi ni stocké : on regarde les dépenses passées. Un même
 * libellé (dates et numéros retirés, `labelKey`) qui revient à intervalle
 * régulier, pour un montant stable, est une dépense récurrente. Les
 * virements internes et l'épargne n'en sont pas : ce ne sont pas des
 * dépenses.
 */
import { daysBetween, shiftDay } from '../../../core/lib/day';
import { labelKey, suggestedPattern } from './classify';
import type { BudgetCategory, BudgetEntry } from './types';

export type Frequency = 'hebdomadaire' | 'mensuel' | 'trimestriel' | 'annuel';

/** Les écarts entre deux paiements, en jours, qui font chaque rythme. */
const RHYTHMS: { frequency: Frequency; min: number; max: number; perYear: number; minCount: number }[] = [
  { frequency: 'hebdomadaire', min: 6, max: 8, perYear: 52, minCount: 4 },
  { frequency: 'mensuel', min: 26, max: 35, perYear: 12, minCount: 3 },
  { frequency: 'trimestriel', min: 85, max: 98, perYear: 4, minCount: 3 },
  { frequency: 'annuel', min: 350, max: 380, perYear: 1, minCount: 2 },
];

/** Un montant est « stable » à 15 % près de la médiane : une hausse de prix reste le même abonnement. */
const AMOUNT_TOLERANCE = 0.15;
/** Les trois quarts des paiements au moins doivent être stables (un mois à 0,99 € de promo n'empêche rien). */
const STABLE_SHARE = 0.75;

export interface Recurring {
  key: string;
  label: string;
  frequency: Frequency;
  /** Le montant habituel (médiane), en positif. */
  amountCents: number;
  /** Le dernier montant payé, en positif. */
  lastAmountCents: number;
  /** Ce que ça coûte ramené au mois. */
  monthlyCents: number;
  count: number;
  firstDay: string;
  lastDay: string;
  /** Le prochain paiement attendu, d'après l'écart habituel. */
  nextDay: string;
  /** Encore payé : le dernier paiement n'a pas plus d'une fois et demie l'écart habituel. */
  active: boolean;
  categoryId: string | null;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

export function detectRecurring(entries: readonly BudgetEntry[], categories: readonly BudgetCategory[], today: string): Recurring[] {
  const excluded = new Set(categories.filter((c) => c.kind === 'transfert' || c.kind === 'epargne').map((c) => c.id));
  const groups = new Map<string, BudgetEntry[]>();
  for (const e of entries) {
    if (e.amountCents >= 0 || (e.categoryId && excluded.has(e.categoryId))) continue;
    const key = labelKey(e.label);
    if (key.length < 3) continue;
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }

  const found: Recurring[] = [];
  for (const [key, list] of groups) {
    // Un seul paiement par jour compte (un double débit n'est pas un rythme).
    const byDay = new Map<string, BudgetEntry>();
    for (const e of list) if (!byDay.has(e.day)) byDay.set(e.day, e);
    const payments = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
    if (payments.length < 2) continue;
    const gaps = payments.slice(1).map((p, i) => daysBetween(payments[i].day, p.day));
    const gap = median(gaps);
    const rhythm = RHYTHMS.find((r) => gap >= r.min && gap <= r.max);
    if (!rhythm || payments.length < rhythm.minCount) continue;
    // La plupart des écarts doivent suivre le rythme, pas seulement leur médiane.
    if (gaps.filter((g) => g >= rhythm.min && g <= rhythm.max).length < Math.ceil(gaps.length * 0.6)) continue;
    const amounts = payments.map((p) => -p.amountCents);
    const usual = median(amounts);
    const stable = amounts.filter((a) => Math.abs(a - usual) <= usual * AMOUNT_TOLERANCE).length;
    if (stable < Math.ceil(payments.length * STABLE_SHARE)) continue;

    const last = payments[payments.length - 1];
    const counts = new Map<string, number>();
    for (const p of payments) counts.set(p.label, (counts.get(p.label) ?? 0) + 1);
    const categoryCounts = new Map<string | null, number>();
    for (const p of payments) categoryCounts.set(p.categoryId, (categoryCounts.get(p.categoryId) ?? 0) + 1);
    // Le libellé le plus fréquent ; s'ils diffèrent tous (une date dans chacun), le plus récent sans ses chiffres.
    const [top, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))[0];
    found.push({
      key,
      label: topCount > 1 ? top : suggestedPattern(last.label) || last.label,
      frequency: rhythm.frequency,
      amountCents: usual,
      lastAmountCents: -last.amountCents,
      monthlyCents: Math.round((usual * rhythm.perYear) / 12),
      count: payments.length,
      firstDay: payments[0].day,
      lastDay: last.day,
      nextDay: shiftDay(last.day, gap),
      active: daysBetween(last.day, today) <= gap * 1.5,
      categoryId: [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0][0],
    });
  }
  return found.sort((a, b) => Number(b.active) - Number(a.active) || b.monthlyCents - a.monthlyCents || a.label.localeCompare(b.label, 'fr'));
}

/** Ce que coûtent, ramenées au mois et à l'année, les dépenses récurrentes encore payées. */
export function recurringTotals(items: readonly Recurring[]): { monthlyCents: number; yearlyCents: number } {
  const monthlyCents = items.filter((i) => i.active).reduce((sum, i) => sum + i.monthlyCents, 0);
  return { monthlyCents, yearlyCents: monthlyCents * 12 };
}

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  hebdomadaire: 'chaque semaine',
  mensuel: 'chaque mois',
  trimestriel: 'chaque trimestre',
  annuel: 'chaque année',
};
