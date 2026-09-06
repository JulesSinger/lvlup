import type { BudgetCategory } from './types';

/**
 * Sous-catégories (« Restaurants & bars » → « Restaurants », « Bar ») — un
 * seul niveau de profondeur, partagé par les deux implémentations du
 * contrat (`LocalBudget`, `SupabaseBudget`) pour ne jamais diverger sur ce
 * qui est une position valide.
 */

/** Une sous-catégorie ne peut jamais elle-même être parente. */
export function isValidParent(categories: BudgetCategory[], parentId: string): boolean {
  const parent = categories.find((c) => c.id === parentId);
  return parent !== undefined && parent.parentId === null;
}

/** Une catégorie qui a déjà des sous-catégories ne peut pas en devenir une. */
export function hasChildren(categories: BudgetCategory[], id: string): boolean {
  return categories.some((c) => c.parentId === id);
}

/** Renumérote `position` par groupe de sœurs (même parent), ordre relatif conservé. */
export function reindexPositions(categories: BudgetCategory[]): void {
  const groups = new Map<string | null, BudgetCategory[]>();
  for (const c of categories) {
    const list = groups.get(c.parentId) ?? [];
    list.push(c);
    groups.set(c.parentId, list);
  }
  for (const list of groups.values()) {
    list.forEach((c, index) => {
      c.position = index;
    });
  }
}
