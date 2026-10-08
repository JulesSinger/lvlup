/**
 * Le menu de la semaine en calque dans Calendar — bibliothèque pure
 * (docs/etude-recettes.md §6.3, §17).
 *
 * Une marque par entrée du menu, sur la journée (« Midi · Lasagnes ») :
 * posée sur une heure, elle encombrerait la grille, et l'heure d'un repas
 * n'est pas une donnée du menu. Glissée sur un autre jour, elle y déplace le
 * repas ; glissée sur une heure, elle devient le midi ou le soir de ce jour.
 */
import type { CalendarMark } from '../../../core/lib/services';
import type { Meal, PlanEntry, Recipe } from './types';

export const MEAL_LABELS: Record<Meal, string> = { midi: 'Midi', soir: 'Soir' };

export function menuMarks(entries: PlanEntry[], recipes: Recipe[], from: string, to: string): CalendarMark[] {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  return entries
    .filter((e) => e.day >= from && e.day <= to)
    .map((e) => {
      const recipe = e.recipeId ? byId.get(e.recipeId) : undefined;
      const title = recipe?.title ?? e.title;
      return {
        id: `plan:${e.id}`,
        day: e.day,
        title: `${MEAL_LABELS[e.meal]} · ${title}`,
        detail: [e.servings ? `pour ${e.servings}` : null, recipe ? 'recette du carnet' : null].filter(Boolean).join(' · ') || undefined,
        movable: true,
        link: recipe ? `recipe:${recipe.id}` : 'menu',
      };
    });
}

/** Le repas d'une heure posée : avant 16 h, le midi ; ensuite, le soir. */
export function mealAt(time: string | null, current: Meal): Meal {
  if (time === null) return current;
  return Number(time.slice(0, 2)) < 16 ? 'midi' : 'soir';
}
