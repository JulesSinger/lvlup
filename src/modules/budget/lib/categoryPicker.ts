import type { BudgetCategory, BudgetCategoryKind, BudgetEntry } from './types';

/**
 * Amélioration post-V1 (31/08/2026) : trouver la bonne catégorie à la
 * saisie manuelle était devenu pénible — un simple `<select>` listant
 * toutes les catégories à plat (docs/etude-astra.md ne le disait pas mieux
 * que « catégorie »). Ce fichier porte la partie « accès rapide » de la
 * réponse : les catégories les plus utilisées, en pastilles, avant même
 * d'ouvrir le menu déroulant. L'autre partie (suggestion par mots-clés) vit
 * dans `boursobankImport.ts#matchRule`, réutilisé tel quel.
 *
 * Depuis le 07/10/2026 (demande de Jules), les propositions suivent le sens
 * choisi : « Dépense » propose les catégories où l'on range ses dépenses,
 * « Entrée » celles où l'on range ses entrées. La fréquence se compte **par
 * sens** plutôt que par nature de catégorie : un remboursement qu'on range
 * toujours dans « Santé » remonte bien côté Entrée, sans règle particulière.
 */

/** Nombre de pastilles proposées — au-delà, ça redevient une liste à lire plutôt qu'un raccourci. */
export const MOST_USED_LIMIT = 6;

export type EntryDirection = 'expense' | 'income';

/** Les natures qui vont d'elles-mêmes avec un sens : de quoi compléter un historique trop court. */
const NATURAL_KINDS: Record<EntryDirection, readonly BudgetCategoryKind[]> = {
  expense: ['variable', 'fixe'],
  income: ['revenu'],
};

/** L'ordre des groupes du menu : ce qui va avec le sens choisi d'abord. */
const MENU_ORDER: Record<EntryDirection, readonly BudgetCategoryKind[]> = {
  expense: ['fixe', 'variable', 'transfert', 'epargne', 'revenu'],
  income: ['revenu', 'epargne', 'transfert', 'fixe', 'variable'],
};

export function menuKindOrder(direction: EntryDirection): readonly BudgetCategoryKind[] {
  return MENU_ORDER[direction];
}

/**
 * Les catégories à proposer pour une écriture de ce sens, les plus
 * utilisées d'abord. L'historique complet compte, pas seulement le mois en
 * cours : une catégorie qu'on utilise chaque mois doit rester en tête même
 * le premier jour d'un nouveau mois.
 *
 * Un historique trop court (premier mois, première entrée d'argent) est
 * complété par les catégories de la nature qui va avec le sens — « Salaire »
 * pour une entrée — plutôt que de laisser des pastilles de dépense ou aucune.
 * Une catégorie supprimée depuis n'est jamais proposée.
 */
export function frequentCategoryIds(
  entries: readonly BudgetEntry[],
  categories: readonly BudgetCategory[],
  direction: EntryDirection,
  limit = MOST_USED_LIMIT,
): string[] {
  const known = new Set(categories.map((c) => c.id));
  const tally = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.categoryId || !known.has(entry.categoryId) || entry.amountCents === 0) continue;
    if ((entry.amountCents < 0 ? 'expense' : 'income') !== direction) continue;
    tally.set(entry.categoryId, (tally.get(entry.categoryId) ?? 0) + 1);
  }
  const ids = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  for (const kind of NATURAL_KINDS[direction]) {
    if (ids.length >= limit) break;
    const natural = categories
      .filter((c) => c.kind === kind && c.parentId === null && !ids.includes(c.id))
      .sort((a, b) => a.position - b.position);
    for (const c of natural) {
      if (ids.length >= limit) break;
      ids.push(c.id);
    }
  }
  return ids;
}
