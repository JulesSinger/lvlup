import type { BudgetEntry } from './types';

/**
 * Amélioration post-V1 (31/08/2026) : trouver la bonne catégorie à la
 * saisie manuelle était devenu pénible — un simple `<select>` listant
 * toutes les catégories à plat (docs/etude-astra.md ne le disait pas mieux
 * que « catégorie »). Cette fonction porte la partie « accès rapide » de la
 * réponse : les catégories les plus utilisées, en pastilles, avant même
 * d'ouvrir le menu déroulant. L'autre partie (suggestion par mots-clés) vit
 * dans `boursobankImport.ts#matchRule`, réutilisé tel quel.
 */

/** Nombre de pastilles proposées — au-delà, ça redevient une liste à lire plutôt qu'un raccourci. */
export const MOST_USED_LIMIT = 6;

/**
 * Les catégories les plus utilisées, classées par fréquence décroissante.
 * Calculée sur l'historique complet des écritures, pas seulement le mois en
 * cours : une catégorie qu'on utilise chaque mois doit rester en tête même
 * le premier jour d'un nouveau mois, quand ses seules occurrences sont dans
 * le mois précédent.
 */
export function mostUsedCategoryIds(entries: BudgetEntry[], limit = MOST_USED_LIMIT): string[] {
  const tally = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.categoryId) continue;
    tally.set(entry.categoryId, (tally.get(entry.categoryId) ?? 0) + 1);
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}
