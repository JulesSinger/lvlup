import { computeMonthlyBreakdown } from './monthlyBreakdown';
import { currentMonthKey, monthKeyOf, shiftMonthKey } from './month';
import type { BudgetCategory, BudgetEntry } from './types';

export interface TrendPoint {
  /** `'2026-07'` */
  monthKey: string;
  /** Dépensé ce mois-là, en positif (magnitude) — jamais négatif. */
  cents: number;
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
 * pas sa place ici : ce n'est pas une dépense qui évolue, et l'épargne a
 * déjà sa propre courbe (`SavingsChart`, onglet Épargne).
 *
 * Comme `weeklyPP` (Zénith) : les mois sans rien dépenser restent dans le
 * graphe, à zéro, plutôt que sautés — une pause doit se voir. La plage
 * commence au premier mois où une dépense existe, quelle que soit la
 * catégorie choisie ensuite : changer de catégorie dans le sélecteur ne
 * doit jamais faire bouger la fenêtre de temps affichée, seulement les
 * barres.
 */
export function computeSpendingTrend(
  entries: BudgetEntry[],
  categories: BudgetCategory[],
  categoryId: string | null,
  todayMonthKey: string = currentMonthKey(),
): TrendPoint[] {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  // La fenêtre démarre au premier mois où une vraie dépense existe — pas au
  // premier mois où *n'importe quelle* écriture existe : un compte qui n'a
  // encore que des virements internes ou de l'épargne n'a rien à montrer ici.
  const isSpendCandidate = (e: BudgetEntry) => {
    const category = e.categoryId ? categoryById.get(e.categoryId) : undefined;
    return category?.kind !== 'transfert' && category?.kind !== 'epargne' && category?.kind !== 'revenu';
  };
  const activityMonths = [...new Set(entries.filter(isSpendCandidate).map((e) => monthKeyOf(e.day)))]
    .filter((m) => m <= todayMonthKey)
    .sort();
  if (activityMonths.length === 0) return [];

  const points: TrendPoint[] = [];
  let cursor = activityMonths[0];
  while (cursor <= todayMonthKey) {
    const breakdown = computeMonthlyBreakdown(entries, categories, cursor);
    const cents =
      categoryId === null
        ? breakdown.totalSpentCents
        : (breakdown.slices.find((s) => s.categoryId === categoryId)?.cents ?? 0);
    points.push({ monthKey: cursor, cents });
    cursor = shiftMonthKey(cursor, 1);
  }
  return points;
}
