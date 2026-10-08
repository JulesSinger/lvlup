/**
 * Ce que la base refuserait, dit en clair avant d'écrire — bibliothèque pure
 * (docs/etude-recettes.md §7). Les bornes sont celles des contraintes de
 * `2026-10-08-recettes-tables.sql`.
 */
import {
  INGREDIENTS_MAX,
  MEALS,
  MINUTES_MAX,
  PLAN_TITLE_MAX,
  RECIPE_CATEGORIES,
  RECIPE_TITLE_MAX,
  SERVINGS_MAX,
  STEPS_MAX,
  TAGS_MAX,
  type CookedInput,
  type PlanEntryInput,
  type RecipeInput,
} from './types';

const inRange = (v: number | null | undefined, min: number, max: number) =>
  v === null || v === undefined || (Number.isInteger(v) && v >= min && v <= max);

export function validateRecipe(input: RecipeInput): string | null {
  const title = input.title.trim();
  if (title.length === 0) return 'Donne un titre à la recette.';
  if (title.length > RECIPE_TITLE_MAX) return `Le titre est trop long (${RECIPE_TITLE_MAX} caractères au plus).`;
  if (!inRange(input.servings, 1, SERVINGS_MAX)) return `Le nombre de personnes va de 1 à ${SERVINGS_MAX}.`;
  for (const [v, what] of [
    [input.prepMinutes, 'préparation'],
    [input.cookMinutes, 'cuisson'],
    [input.restMinutes, 'repos'],
  ] as const) {
    if (!inRange(v, 0, MINUTES_MAX)) return `Le temps de ${what} va de 0 à ${MINUTES_MAX} minutes (une semaine).`;
  }
  if (input.category && !(RECIPE_CATEGORIES as readonly string[]).includes(input.category)) return 'Catégorie inconnue.';
  if ((input.tags?.length ?? 0) > TAGS_MAX) return `${TAGS_MAX} étiquettes au plus.`;
  if ((input.ingredients?.length ?? 0) > INGREDIENTS_MAX) return `${INGREDIENTS_MAX} ingrédients au plus.`;
  if ((input.steps?.length ?? 0) > STEPS_MAX) return `${STEPS_MAX} étapes au plus.`;
  if (input.sourceUrl && !/^https?:\/\//.test(input.sourceUrl)) return 'Le lien de la source doit commencer par http:// ou https://.';
  return null;
}

export function validatePlanEntry(input: PlanEntryInput): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) return 'Jour invalide.';
  if (!(MEALS as readonly string[]).includes(input.meal)) return 'Repas inconnu.';
  if (!input.recipeId && input.title.trim().length === 0) return 'Choisis une recette, ou écris ce que tu manges (« Restes »).';
  if (input.title.length > PLAN_TITLE_MAX) return `${PLAN_TITLE_MAX} caractères au plus.`;
  if (!inRange(input.servings, 1, SERVINGS_MAX)) return `Le nombre de personnes va de 1 à ${SERVINGS_MAX}.`;
  return null;
}

export function validateCooked(input: Pick<CookedInput, 'day' | 'servings' | 'rating'>): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) return 'Jour invalide.';
  if (!inRange(input.servings, 1, SERVINGS_MAX)) return `Le nombre de personnes va de 1 à ${SERVINGS_MAX}.`;
  if (!inRange(input.rating, 1, 5)) return 'La note va de 1 à 5.';
  return null;
}
