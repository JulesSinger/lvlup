/**
 * Retrouver une recette — bibliothèque pure (docs/etude-recettes.md §4.4).
 * Toutes les recettes sont chargées : la recherche se fait ici, instantanée.
 */
import { totalMinutes } from './duration';
import { fold, ingredientKey, isSectionHeading, parseIngredient } from './ingredients';
import type { Cooked, Recipe, RecipeCategory } from './types';

export interface RecipeFilters {
  query: string;
  category: RecipeCategory | null;
  /** « Moins de 30 min » : temps total. Une recette sans temps n'y entre pas. */
  maxMinutes: number | null;
  favorites: boolean;
  /** « Jamais faite ». */
  neverCooked: boolean;
}

export const NO_FILTERS: RecipeFilters = { query: '', category: null, maxMinutes: null, favorites: false, neverCooked: false };

const words = (text: string) => fold(text).split(/[^a-z0-9']+/).filter(Boolean);

/** Tout ce qu'on peut chercher dans une recette, replié. */
function haystack(r: Recipe): string {
  return fold([r.title, r.tags.join(' '), r.sourceName, ...r.ingredients.map((i) => parseIngredient(i.text).name)].join(' '));
}

/** Chaque mot tapé doit se trouver quelque part (titre, étiquette, ingrédient, source). */
export function searchRecipes(recipes: Recipe[], filters: RecipeFilters, cooked: Cooked[] = []): Recipe[] {
  const tokens = words(filters.query);
  const done = new Set(cooked.map((c) => c.recipeId));
  return recipes.filter((r) => {
    if (filters.category && r.category !== filters.category) return false;
    if (filters.favorites && !r.favorite) return false;
    if (filters.neverCooked && done.has(r.id)) return false;
    if (filters.maxMinutes !== null) {
      const total = totalMinutes(r);
      if (total === null || total > filters.maxMinutes) return false;
    }
    if (tokens.length === 0) return true;
    const hay = haystack(r);
    return tokens.every((t) => hay.includes(t));
  });
}

export interface HaveMatch {
  recipe: Recipe;
  found: string[];
  /** Les ingrédients de la recette qu'on n'a pas dits (hors « toujours là »). */
  missing: number;
}

/**
 * « Avec ce que j'ai » : « courgette, feta » classe les recettes par nombre
 * d'ingrédients trouvés, puis par ce qui manque. Pas de stock à tenir.
 */
export function withWhatIHave(recipes: Recipe[], text: string, pantry: string[] = []): HaveMatch[] {
  // Chaque mot tel qu'il est tapé (pour le dire) et replié (pour comparer).
  const typed = text
    .split(/[,;\n]+|\s+et\s+/)
    .map((w) => ({ label: w.trim(), key: ingredientKey(w) }))
    .filter((w) => w.key);
  const wanted = typed.map((w) => w.key);
  if (wanted.length === 0) return [];
  const always = new Set(pantry.map(ingredientKey));
  const out: HaveMatch[] = [];
  for (const recipe of recipes) {
    const keys = recipe.ingredients.filter((i) => !isSectionHeading(i.text)).map((i) => parseIngredient(i.text).key);
    const found = typed.filter(({ key: w }) => keys.some((k) => k === w || k.split(' ').includes(w) || k.startsWith(`${w} `))).map((w) => w.label);
    if (found.length === 0) continue;
    const missing = keys.filter((k) => !always.has(k) && !wanted.some((w) => k === w || k.split(' ').includes(w) || k.startsWith(`${w} `))).length;
    out.push({ recipe, found, missing });
  }
  return out.sort((a, b) => b.found.length - a.found.length || a.missing - b.missing || a.recipe.title.localeCompare(b.recipe.title, 'fr'));
}

/** « Faite 4 fois, la dernière le 12 mars » : pour la fiche et le carnet. */
export function cookedSummary(recipeId: string, cooked: Cooked[]): { count: number; last: string | null; rating: number | null } {
  const mine = cooked.filter((c) => c.recipeId === recipeId);
  const rated = mine.filter((c) => c.rating !== null);
  return {
    count: mine.length,
    last: mine.reduce<string | null>((m, c) => (m === null || c.day > m ? c.day : m), null),
    rating: rated.length ? Math.round((rated.reduce((s, c) => s + (c.rating ?? 0), 0) / rated.length) * 10) / 10 : null,
  };
}
