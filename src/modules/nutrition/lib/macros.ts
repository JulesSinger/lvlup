/**
 * Calculs sur les macronutriments — bibliothèque pure, sans écran ni stockage
 * (docs/etude-nutrition.md §7). Tout est en entiers : kcal entières,
 * macronutriments en décigrammes (`…Dg`, 125 = 12,5 g), objectifs en grammes
 * (`…G`) — voir `lib/types.ts`.
 */

/** kcal apportées par un gramme de chaque macronutriment (étude §2). */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

export type MacroKey = keyof typeof KCAL_PER_GRAM;
export const MACRO_KEYS: readonly MacroKey[] = ['protein', 'carbs', 'fat'];

/** Les valeurs d'un aliment (pour 100 g) ou d'une portion, d'un repas, d'un jour. */
export interface NutrientValues {
  kcal: number;
  proteinDg: number;
  carbsDg: number;
  fatDg: number;
}

export const ZERO: NutrientValues = { kcal: 0, proteinDg: 0, carbsDg: 0, fatDg: 0 };

/**
 * Valeurs d'une quantité, à partir des valeurs pour 100 g.
 *
 * Arrondi à l'entier le plus proche, une seule fois, ici : c'est le résultat
 * de ce calcul qui est figé dans l'entrée du journal (étude §6), puis
 * seulement additionné — jamais recalculé.
 */
export function valuesForGrams(per100g: NutrientValues, grams: number): NutrientValues {
  const scale = (v: number) => Math.round((v * grams) / 100);
  return {
    kcal: scale(per100g.kcal),
    proteinDg: scale(per100g.proteinDg),
    carbsDg: scale(per100g.carbsDg),
    fatDg: scale(per100g.fatDg),
  };
}

/** Somme de plusieurs valeurs — un repas, une journée. Des entiers : aucune dérive. */
export function sumValues(items: readonly NutrientValues[]): NutrientValues {
  return items.reduce(
    (acc, v) => ({
      kcal: acc.kcal + v.kcal,
      proteinDg: acc.proteinDg + v.proteinDg,
      carbsDg: acc.carbsDg + v.carbsDg,
      fatDg: acc.fatDg + v.fatDg,
    }),
    ZERO,
  );
}

/**
 * kcal d'un objectif en grammes. Décision du 25/09/2026 (étude §12) : les
 * kcal d'un objectif ne sont jamais stockées, toujours déduites — elles ne
 * peuvent donc pas contredire les macros.
 */
export function targetKcal(target: { proteinG: number; carbsG: number; fatG: number }): number {
  return (
    target.proteinG * KCAL_PER_GRAM.protein +
    target.carbsG * KCAL_PER_GRAM.carbs +
    target.fatG * KCAL_PER_GRAM.fat
  );
}

/**
 * Part de chaque macronutriment dans l'énergie, en pourcentages entiers.
 *
 * Calculée depuis les grammes (4/4/9), pas depuis le champ `kcal` : celui-ci
 * inclut l'alcool, les polyols et les arrondis de l'étiquette, et les trois
 * parts ne feraient plus 100 %. L'arrondi est réparti pour que la somme
 * fasse toujours exactement 100 (méthode du plus fort reste) — sinon un
 * affichage « 33 % / 33 % / 33 % » laisserait un point se perdre. Aucune
 * énergie (un verre d'eau) : trois zéros.
 */
export function energyShares(values: Pick<NutrientValues, 'proteinDg' | 'carbsDg' | 'fatDg'>): Record<MacroKey, number> {
  const energy: Record<MacroKey, number> = {
    protein: values.proteinDg * KCAL_PER_GRAM.protein,
    carbs: values.carbsDg * KCAL_PER_GRAM.carbs,
    fat: values.fatDg * KCAL_PER_GRAM.fat,
  };
  const total = energy.protein + energy.carbs + energy.fat;
  if (total <= 0) return { protein: 0, carbs: 0, fat: 0 };

  const exact = MACRO_KEYS.map((k) => ({ k, value: (energy[k] * 100) / total }));
  const shares = Object.fromEntries(exact.map(({ k, value }) => [k, Math.floor(value)])) as Record<MacroKey, number>;
  let missing = 100 - MACRO_KEYS.reduce((sum, k) => sum + shares[k], 0);
  const byRemainder = exact.slice().sort((a, b) => (b.value % 1) - (a.value % 1));
  for (const { k } of byRemainder) {
    if (missing <= 0) break;
    shares[k] += 1;
    missing -= 1;
  }
  return shares;
}

/**
 * Grammes correspondant à une part de l'énergie : l'aide du calculateur
 * (étape 4), qui propose un objectif en grammes à partir des repères ANSES
 * exprimés en pourcentages (étude §2). Arrondi au gramme.
 */
export function gramsForShare(kcal: number, percent: number, macro: MacroKey): number {
  return Math.round((kcal * percent) / 100 / KCAL_PER_GRAM[macro]);
}

/** « 12,5 g », « 12 g » — des décigrammes vers un texte lisible, sans décimale inutile. */
export function formatDg(dg: number): string {
  const grams = Math.round(dg) / 10;
  return `${grams.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} g`;
}
