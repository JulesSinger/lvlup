import { computeMonthlyBreakdown } from './monthlyBreakdown';
import { currentMonthKey, monthKeyOf, shiftMonthKey } from './month';
import type { BudgetCategory, BudgetEntry } from './types';

export interface TrendPoint {
  /** `'2026-07'` */
  monthKey: string;
  /** Dépensé (ou entré) ce mois-là, en positif (magnitude) — jamais négatif. */
  cents: number;
}

/**
 * Tous les mois entre le premier où `isRelevant` trouve une écriture et
 * `todayMonthKey`, sans en sauter aucun — comme `weeklyPP` (Zénith) : une
 * pause doit se voir, pas disparaître du graphe.
 */
function monthRange(entries: BudgetEntry[], isRelevant: (e: BudgetEntry) => boolean, todayMonthKey: string): string[] {
  const activityMonths = [...new Set(entries.filter(isRelevant).map((e) => monthKeyOf(e.day)))]
    .filter((m) => m <= todayMonthKey)
    .sort();
  if (activityMonths.length === 0) return [];

  const months: string[] = [];
  let cursor = activityMonths[0];
  while (cursor <= todayMonthKey) {
    months.push(cursor);
    cursor = shiftMonthKey(cursor, 1);
  }
  return months;
}

/**
 * L'évolution d'une dépense dans le temps (onglet Évolution, demandé par
 * Jules le 06/09/2026 : « voir cette évolution au fil du temps ») —
 * `categoryId` choisit une catégorie précise (ses sous-catégories remontées
 * dedans, comme le camembert du mois), ou `null` pour le total de toutes
 * les dépenses.
 *
 * Rejoue `computeMonthlyBreakdown` mois par mois plutôt que de recalculer
 * les mêmes règles à part : le rollup des sous-catégories, l'exclusion de
 * `transfert`/`epargne`, et le fait qu'un remboursement réduit une part
 * sans jamais la faire passer en négatif, sont exactement les mêmes qu'au
 * camembert — jamais deux calculs qui pourraient diverger. `revenu` n'a
 * pas sa place ici : ce n'est pas une dépense qui évolue.
 *
 * La plage commence au premier mois où une dépense existe, et ne bouge
 * jamais quand on change de catégorie dans le sélecteur : comparer, c'est
 * garder le même axe des temps sous les yeux.
 */
export function computeSpendingTrend(
  entries: BudgetEntry[],
  categories: BudgetCategory[],
  categoryId: string | null,
  todayMonthKey: string = currentMonthKey(),
): TrendPoint[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const isSpendCandidate = (e: BudgetEntry) => {
    const category = e.categoryId ? categoryById.get(e.categoryId) : undefined;
    return category?.kind !== 'transfert' && category?.kind !== 'epargne' && category?.kind !== 'revenu';
  };
  return monthRange(entries, isSpendCandidate, todayMonthKey).map((monthKey) => {
    const breakdown = computeMonthlyBreakdown(entries, categories, monthKey);
    const cents =
      categoryId === null
        ? breakdown.totalSpentCents
        : (breakdown.slices.find((s) => s.categoryId === categoryId)?.cents ?? 0);
    return { monthKey, cents };
  });
}

/**
 * Le pendant de `computeSpendingTrend` côté entrées (demandé par Jules le
 * 07/09/2026 : « combien j'ai eu de rentrées par mois ») — même
 * construction, mêmes garanties, juste `incomeSlices`/`totalIncomeCents` au
 * lieu de `slices`/`totalSpentCents`. `categoryId` porte ici une catégorie
 * `revenu` (Salaire, Aides…), ou `null` pour le total des entrées.
 */
export function computeIncomeTrend(
  entries: BudgetEntry[],
  categories: BudgetCategory[],
  categoryId: string | null,
  todayMonthKey: string = currentMonthKey(),
): TrendPoint[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const isIncomeCandidate = (e: BudgetEntry) => {
    const category = e.categoryId ? categoryById.get(e.categoryId) : undefined;
    return category?.kind !== 'transfert' && category?.kind !== 'epargne';
  };
  return monthRange(entries, isIncomeCandidate, todayMonthKey).map((monthKey) => {
    const breakdown = computeMonthlyBreakdown(entries, categories, monthKey);
    const cents =
      categoryId === null
        ? breakdown.totalIncomeCents
        : (breakdown.incomeSlices.find((s) => s.categoryId === categoryId)?.cents ?? 0);
    return { monthKey, cents };
  });
}

export interface NetPoint {
  /** `'2026-07'` */
  monthKey: string;
  /** Entré moins dépensé — peut être négatif : le mois est resté dans le rouge. */
  cents: number;
}

/**
 * Le différentiel mensuel (demandé par Jules le 07/09/2026 : « de combien
 * je suis en négatif ou positif chaque mois, pour comparer ») — exactement
 * le calcul déjà affiché sous « Solde » sur l'onglet Aperçu
 * (`totalIncomeCents - totalSpentCents`), rejoué mois par mois. Peut être
 * négatif, à la différence de `TrendPoint` : jamais de `Math.abs` ici, le
 * signe *est* l'information.
 */
export function computeNetTrend(
  entries: BudgetEntry[],
  categories: BudgetCategory[],
  todayMonthKey: string = currentMonthKey(),
): NetPoint[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const isRelevant = (e: BudgetEntry) => {
    const category = e.categoryId ? categoryById.get(e.categoryId) : undefined;
    return category?.kind !== 'transfert' && category?.kind !== 'epargne';
  };
  return monthRange(entries, isRelevant, todayMonthKey).map((monthKey) => {
    const breakdown = computeMonthlyBreakdown(entries, categories, monthKey);
    return { monthKey, cents: breakdown.totalIncomeCents - breakdown.totalSpentCents };
  });
}
