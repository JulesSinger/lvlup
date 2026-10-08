/**
 * Les types du module Recettes (docs/etude-recettes.md §4, §7, §12).
 *
 * Chaque liste `as const` a son pendant dans une contrainte CHECK de la
 * migration `2026-10-08-recettes-tables.sql` ; `schema.test.ts` compare les
 * deux (CLAUDE.md §5).
 */

/** Les catégories, fixes : elles donnent l'emblème d'une recette sans photo. */
export const RECIPE_CATEGORIES = ['entree', 'plat', 'dessert', 'aperitif', 'petit-dejeuner', 'accompagnement', 'sauce', 'boisson', 'autre'] as const;
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

/** Les repas du menu de la semaine (§12 : midi et soir). */
export const MEALS = ['midi', 'soir'] as const;
export type Meal = (typeof MEALS)[number];

export const RECIPE_TITLE_MAX = 200;
export const SERVINGS_MAX = 100;
/** Une semaine : une marinade, un levain. */
export const MINUTES_MAX = 10_080;
export const INGREDIENTS_MAX = 150;
export const STEPS_MAX = 80;
export const TAGS_MAX = 20;
export const PLAN_TITLE_MAX = 120;

/**
 * Un ingrédient, **tel qu'il est écrit** (« 2 gousses d'ail ») : c'est la
 * vérité, jamais perdue. Sa lecture (quantité, unité, nom) se calcule
 * (`lib/ingredients.ts`, étape 2) et n'est pas rangée : elle ne peut pas
 * contredire le texte, et un meilleur analyseur relira les anciennes
 * recettes sans rien perdre — même principe que l'allure de Sport.
 */
export interface Ingredient {
  text: string;
  /** Le groupe : « Pour la béchamel » ; null hors groupe. */
  section: string | null;
}

export interface Step {
  text: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  /** Le nombre de personnes (ou de pièces) que donne la recette ; null s'il n'est pas dit. */
  servings: number | null;
  /** Ce que compte `servings` : « personnes », « crêpes », « moule ». */
  yieldLabel: string;
  prepMinutes: number | null;
  cookMinutes: number | null;
  restMinutes: number | null;
  category: RecipeCategory;
  tags: string[];
  /** D'où elle vient : un lien, un livre, « Maman ». */
  sourceUrl: string | null;
  sourceName: string;
  /** La note personnelle : « doubler l'ail ». */
  note: string;
  favorite: boolean;
  ingredients: Ingredient[];
  steps: Step[];
  createdAt: string;
  updatedAt: string;
}

export interface RecipeInput {
  title: string;
  description?: string;
  servings?: number | null;
  yieldLabel?: string;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  restMinutes?: number | null;
  category?: RecipeCategory;
  tags?: string[];
  sourceUrl?: string | null;
  sourceName?: string;
  note?: string;
  favorite?: boolean;
  ingredients?: Ingredient[];
  steps?: Step[];
}

export type RecipePatch = Partial<RecipeInput>;

/**
 * La photo d'une recette — **une seule** (§12 : le plus économique), réduite
 * dans le navigateur. Les fichiers vivent dans le bucket privé `recettes`
 * (ou IndexedDB en mode local).
 */
export interface RecipePhoto {
  id: string;
  recipeId: string;
  path: string;
  thumbPath: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
}

/** « Je l'ai faite » : le jour, pour combien, une note, un mot. */
export interface Cooked {
  id: string;
  recipeId: string;
  day: string;
  servings: number | null;
  /** De 1 à 5 ; null sans note. */
  rating: number | null;
  comment: string;
  createdAt: string;
}

export type CookedInput = Omit<Cooked, 'id' | 'createdAt'>;

/**
 * Une case du menu de la semaine : une recette, ou un simple titre (« Restes »,
 * « Resto avec Paul ») quand il n'y a rien à cuisiner.
 */
export interface PlanEntry {
  id: string;
  day: string;
  meal: Meal;
  recipeId: string | null;
  title: string;
  servings: number | null;
  /** L'ordre dans la case (un plat puis un dessert). */
  position: number;
  createdAt: string;
}

export type PlanEntryInput = Omit<PlanEntry, 'id' | 'createdAt'>;

/** Ce qu'on a toujours chez soi : décoché d'office avant d'envoyer à Courses (§12). */
export const DEFAULT_PANTRY = ['sel', 'poivre', 'huile', 'huile d’olive', 'sucre', 'farine', 'eau', 'vinaigre'];

export interface RecettesSettings {
  pantry: string[];
}

export const DEFAULT_RECETTES_SETTINGS: RecettesSettings = { pantry: DEFAULT_PANTRY };
