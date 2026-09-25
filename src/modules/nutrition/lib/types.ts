/**
 * Types du module nutrition (Cérès). Conception complète : docs/etude-nutrition.md.
 *
 * Unités : entiers partout, comme les centimes d'Astra — jamais de flottant
 * qu'une addition ferait dériver. Les kcal sont entières, les
 * macronutriments en décigrammes (`…Dg`, dixièmes de gramme : 125 = 12,5 g),
 * les objectifs en grammes entiers (`…G`).
 */

/**
 * Les repas d'une journée. Le pendant de la contrainte
 * `nutrition_entries_meal_check` : `lib/schema.test.ts` compare les deux,
 * même discipline que `TIER_KINDS` (CLAUDE.md §5).
 */
export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collation',
};

/**
 * D'où vient un aliment de `nutrition_foods` : saisi à la main, ou recopié
 * d'Open Food Facts au scan (étape 6). Les aliments CIQUAL n'y figurent
 * jamais : ils sont embarqués dans l'application (étude §4).
 */
export const FOOD_SOURCES = ['custom', 'off'] as const;
export type FoodSource = (typeof FOOD_SOURCES)[number];

/** Un aliment personnel ou scanné. Valeurs pour 100 g. */
export interface Food {
  id: string;
  source: FoodSource;
  /** Code EAN, unique par compte quand il existe */
  barcode: string | null;
  name: string;
  brand: string | null;
  kcal: number;
  proteinDg: number;
  carbsDg: number;
  fatDg: number;
  /** Pas toujours sur l'étiquette */
  fiberDg: number | null;
  /** « 1 pot = 125 g » */
  servingGrams: number | null;
  favorite: boolean;
  createdAt: string;
}

/** Le nom et les valeurs sont obligatoires ; le reste a une valeur par défaut. */
export type FoodInput = Pick<Food, 'name' | 'kcal' | 'proteinDg' | 'carbsDg' | 'fatDg'> &
  Partial<Pick<Food, 'source' | 'barcode' | 'brand' | 'fiberDg' | 'servingGrams' | 'favorite'>>;

/**
 * Ce qui a été mangé : une ligne par aliment.
 *
 * `label`, `kcal` et les macros sont FIGÉS à la saisie, comme les PP d'un
 * check-in de Zénith (étude §6) : corriger un aliment ne réécrit jamais le
 * passé. Le contrat de stockage ne les calcule pas — l'écran les calcule
 * (étape 2, `lib/macros.ts`) et les lui passe tels quels, même séparation
 * que `reviewCard` d'Orbite.
 *
 * Au plus une des deux références ; les deux sont nulles une fois l'aliment
 * perso supprimé, sans que la ligne disparaisse.
 */
export interface Entry {
  id: string;
  /** Jour local (YYYY-MM-DD) */
  day: string;
  meal: Meal;
  foodId: string | null;
  ciqualCode: string | null;
  label: string;
  grams: number;
  kcal: number;
  proteinDg: number;
  carbsDg: number;
  fatDg: number;
  createdAt: string;
}

export type EntryInput = Omit<Entry, 'id' | 'createdAt'>;

/**
 * Objectif quotidien, daté. En grammes (décision du 25/09/2026, étude §12) :
 * les kcal s'en déduisent (4/4/9) et ne sont jamais stockées à part.
 * L'objectif d'un jour est celui dont `effectiveFrom` est le plus récent sans
 * dépasser ce jour.
 */
export interface Target {
  id: string;
  effectiveFrom: string;
  proteinG: number;
  carbsG: number;
  fatG: number;
  createdAt: string;
}

export type TargetInput = Omit<Target, 'id' | 'createdAt'>;
