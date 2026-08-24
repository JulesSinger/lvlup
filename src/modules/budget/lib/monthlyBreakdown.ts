import { monthKeyOf } from './month';
import type { BudgetCategory, BudgetEntry } from './types';

/** Couleur neutre pour la part « À classer » — elle n'a pas de catégorie, donc pas de couleur choisie. */
const UNCATEGORIZED_COLOR = '#8a8f98';

export interface BudgetSlice {
  /** `null` = « À classer ». */
  categoryId: string | null;
  label: string;
  emoji: string;
  color: string;
  /** Montant dépensé pour cette part, positif (magnitude). */
  cents: number;
}

export interface MonthlyBreakdown {
  /** Somme des parts, en positif — ce qui a été dépensé ce mois-ci. */
  totalSpentCents: number;
  slices: BudgetSlice[];
}

/**
 * Le camembert du mois (docs/etude-astra.md §5).
 *
 * Deux règles explicites dans l'étude : `kind === 'transfert'` est exclu du
 * camembert (§2 et §6 — sans quoi épargner ressemblerait à dépenser), et une
 * écriture non catégorisée doit apparaître sous « À classer » plutôt que
 * disparaître du total (§2 — « si on la masquait, le total afficherait moins
 * que ce qui a réellement quitté le compte »).
 *
 * Une troisième règle n'est *pas* explicite dans le texte et relève d'une
 * interprétation assumée ici : seuls les groupes au net **négatif** sur le
 * mois deviennent une part. Un camembert de "constat" (§1) répond à la
 * question « où est parti l'argent » ; un groupe au net positif — une
 * catégorie `revenu` comme Salaire, ou une catégorie entièrement remboursée
 * ce mois-ci — n'y a pas sa place, sans qu'il faille pour autant écrire un
 * cas particulier sur `kind === 'revenu'` : le signe suffit, et il reflète
 * exactement le remboursement décrit en §6 (« la catégorie totalise alors
 * 40 € de moins »). Cette règle n'exclut jamais une écriture non catégorisée
 * *dépensée* : une entrée d'argent isolée sans catégorie (ex. un
 * remboursement d'ami) nette positif et disparaît du camembert, mais rien
 * qui a quitté le compte ne peut y disparaître, ce qui respecte la garantie
 * du §2 ci-dessus.
 */
export function computeMonthlyBreakdown(
  entries: BudgetEntry[],
  categories: BudgetCategory[],
  monthKey: string,
): MonthlyBreakdown {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const netByKey = new Map<string, number>();

  for (const entry of entries) {
    if (monthKeyOf(entry.day) !== monthKey) continue;
    const category = entry.categoryId ? categoryById.get(entry.categoryId) : undefined;
    if (category?.kind === 'transfert') continue;
    const key = entry.categoryId ?? '';
    netByKey.set(key, (netByKey.get(key) ?? 0) + entry.amountCents);
  }

  const slices: BudgetSlice[] = [];
  for (const [key, net] of netByKey) {
    if (net >= 0) continue;
    const category = key ? categoryById.get(key) : undefined;
    slices.push({
      categoryId: key || null,
      label: category ? category.name : 'À classer',
      emoji: category ? category.emoji : '❔',
      color: category ? category.color : UNCATEGORIZED_COLOR,
      cents: -net,
    });
  }

  slices.sort((a, b) => b.cents - a.cents);
  const totalSpentCents = slices.reduce((sum, s) => sum + s.cents, 0);
  return { totalSpentCents, slices };
}
