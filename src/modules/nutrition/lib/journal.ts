/**
 * Le journal du jour — bibliothèque pure derrière l'écran de l'étape 3
 * (docs/etude-nutrition.md §5, §10) : regrouper par repas, retrouver les
 * aliments récents, copier un repas d'un autre jour, trouver l'objectif en
 * vigueur. Aucune écriture ici : l'écran passe les résultats au contrat.
 */
import { sumValues, type NutrientValues } from './macros';
import { MEALS, type Entry, type EntryInput, type Meal, type Target } from './types';

/** Les entrées d'un jour, par repas, dans l'ordre de saisie. */
export function groupByMeal(entries: readonly Entry[]): Record<Meal, Entry[]> {
  const groups = Object.fromEntries(MEALS.map((m) => [m, [] as Entry[]])) as Record<Meal, Entry[]>;
  const ordered = entries.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const entry of ordered) groups[entry.meal].push(entry);
  return groups;
}

export function totalOf(entries: readonly Entry[]): NutrientValues {
  return sumValues(entries);
}

/** Un aliment déjà mangé, tel que le journal s'en souvient. */
export interface RecentFood {
  /** `ciqual:<code>` ou `food:<id>` — la même clé que la recherche */
  key: string;
  ciqualCode: string | null;
  foodId: string | null;
  label: string;
  /** Quantité de la dernière fois : proposée par défaut à la suivante */
  lastGrams: number;
  /** Nombre de fois où il a été noté */
  count: number;
  lastAt: string;
}

/** La clé qui identifie un aliment, qu'il vienne de CIQUAL ou des aliments perso. */
export function foodKey(ref: { ciqualCode: string | null; foodId: string | null }): string | null {
  if (ref.ciqualCode) return `ciqual:${ref.ciqualCode}`;
  if (ref.foodId) return `food:${ref.foodId}`;
  return null;
}

/**
 * Les aliments déjà notés, le plus récemment mangé d'abord — la moitié du
 * remède à la friction de saisie (étude §3). Une entrée dont l'aliment perso
 * a été supprimé n'a plus de référence : elle n'est pas proposée.
 */
export function recentFoods(entries: readonly Entry[]): RecentFood[] {
  const byKey = new Map<string, RecentFood>();
  for (const entry of entries) {
    const key = foodKey(entry);
    if (!key) continue;
    const known = byKey.get(key);
    if (!known) {
      byKey.set(key, {
        key,
        ciqualCode: entry.ciqualCode,
        foodId: entry.foodId,
        label: entry.label,
        lastGrams: entry.grams,
        count: 1,
        lastAt: entry.createdAt,
      });
      continue;
    }
    known.count += 1;
    if (entry.createdAt > known.lastAt) {
      known.lastAt = entry.createdAt;
      known.lastGrams = entry.grams;
      known.label = entry.label;
    }
  }
  return [...byKey.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/**
 * Recopie un repas sur un autre jour (« même petit-déjeuner qu'hier »).
 * Les valeurs figées sont reprises telles quelles : on a mangé la même
 * chose, pas l'aliment tel qu'il serait décrit aujourd'hui.
 */
export function copyMeal(source: readonly Entry[], meal: Meal, toDay: string, toMeal: Meal = meal): EntryInput[] {
  return source
    .filter((e) => e.meal === meal)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(({ id: _id, createdAt: _createdAt, ...rest }) => ({ ...rest, day: toDay, meal: toMeal }));
}

/**
 * Nouvelle quantité d'une entrée déjà saisie : ses valeurs figées sont
 * remises à l'échelle, sans relire l'aliment d'origine — qui a pu être
 * corrigé ou supprimé depuis. L'entrée reste celle de l'aliment tel qu'il
 * était quand on l'a noté (étude §6).
 */
export function rescaleEntry(entry: Entry, grams: number): Pick<EntryInput, 'grams' | keyof NutrientValues> {
  const scale = (v: number) => Math.round((v * grams) / entry.grams);
  return {
    grams,
    kcal: scale(entry.kcal),
    proteinDg: scale(entry.proteinDg),
    carbsDg: scale(entry.carbsDg),
    fatDg: scale(entry.fatDg),
  };
}

/**
 * L'objectif en vigueur un jour donné : le plus récent dont `effectiveFrom`
 * ne dépasse pas ce jour (étude §6). Changer d'objectif ne rejuge donc pas
 * les jours passés. `null` avant le tout premier objectif.
 */
export function targetForDay(targets: readonly Target[], day: string): Target | null {
  let found: Target | null = null;
  for (const target of targets) {
    if (target.effectiveFrom <= day && (!found || target.effectiveFrom > found.effectiveFrom)) {
      found = target;
    }
  }
  return found;
}
