/**
 * Le calculateur d'objectif — bibliothèque pure (docs/etude-nutrition.md §2,
 * §7). Il PROPOSE un point de départ en grammes ; l'objectif enregistré
 * reste ce que l'utilisateur valide, toujours modifiable à la main
 * (décision du 25/09/2026, étude §12 : objectif en grammes, kcal déduites).
 *
 * C'est une estimation à ±10–15 % : la formule ne connaît ni la composition
 * corporelle ni l'activité réelle d'une journée.
 */
import { gramsForShare, KCAL_PER_GRAM, type MacroKey } from './macros';

export type Sex = 'male' | 'female';

export interface Profile {
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
}

/** Facteurs d'activité usuels, appliqués au métabolisme de base. */
export const ACTIVITY_LEVELS = [
  { factor: 1.2, label: 'Sédentaire', detail: 'travail assis, peu ou pas de sport' },
  { factor: 1.375, label: 'Légèrement actif', detail: 'sport 1 à 3 fois par semaine' },
  { factor: 1.55, label: 'Actif', detail: 'sport 3 à 5 fois par semaine' },
  { factor: 1.725, label: 'Très actif', detail: 'sport 6 à 7 fois par semaine' },
  { factor: 1.9, label: 'Extrêmement actif', detail: 'travail physique et sport quotidien' },
] as const;

/**
 * Le but, en correction de la dépense estimée. En pourcentage plutôt qu'en
 * kcal fixes (« −500 ») : un même écart pèse très différemment sur 1 700 et
 * sur 3 000 kcal.
 */
export const GOALS = [
  { id: 'lose', label: 'Perdre du poids', factor: 0.85 },
  { id: 'maintain', label: 'Maintenir', factor: 1 },
  { id: 'gain', label: 'Prendre du muscle', factor: 1.1 },
] as const;
export type GoalId = (typeof GOALS)[number]['id'];

/**
 * Protéines en grammes par kilo : la référence française pour l'adulte, et
 * la fourchette sportive courante (étude §2).
 */
export const PROTEIN_PER_KG = [
  { value: 0.83, label: '0,83 g/kg (référence)' },
  { value: 1.6, label: '1,6 g/kg (sportif)' },
  { value: 2, label: '2 g/kg (muscle, sèche)' },
] as const;

/**
 * Repères ANSES pour l'adulte, en part de l'énergie (étude §2). Affichés à
 * côté de l'objectif comme une aide, jamais imposés.
 */
export const ANSES_RANGES: Record<MacroKey, readonly [number, number]> = {
  protein: [10, 20],
  carbs: [40, 55],
  fat: [35, 40],
};

/** Part des lipides retenue par le calculateur : le bas de la fourchette ANSES. */
export const DEFAULT_FAT_SHARE = 35;

/** Métabolisme de base, formule de Mifflin-St Jeor (kcal par jour). */
export function basalMetabolicRate({ sex, age, weightKg, heightCm }: Profile): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

export interface Estimate {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/**
 * Propose un objectif en grammes :
 * 1. dépense = métabolisme de base × activité × but ;
 * 2. protéines = poids × g/kg choisis ;
 * 3. lipides = 35 % de l'énergie (bas de la fourchette ANSES) ;
 * 4. glucides = le reste de l'énergie, jamais négatif.
 *
 * Les kcal renvoyées sont celles des grammes proposés (4/4/9), pas la
 * dépense brute : c'est ce que l'objectif vaudra une fois enregistré, et les
 * deux chiffres ne doivent jamais se contredire à l'écran.
 */
export function estimateTarget(
  profile: Profile,
  activityFactor: number,
  goal: GoalId,
  proteinPerKg: number,
): Estimate {
  const goalFactor = GOALS.find((g) => g.id === goal)?.factor ?? 1;
  const energy = basalMetabolicRate(profile) * activityFactor * goalFactor;
  const proteinG = Math.round(profile.weightKg * proteinPerKg);
  const fatG = gramsForShare(energy, DEFAULT_FAT_SHARE, 'fat');
  const remaining = energy - proteinG * KCAL_PER_GRAM.protein - fatG * KCAL_PER_GRAM.fat;
  const carbsG = Math.max(0, Math.round(remaining / KCAL_PER_GRAM.carbs));
  return {
    kcal: proteinG * KCAL_PER_GRAM.protein + carbsG * KCAL_PER_GRAM.carbs + fatG * KCAL_PER_GRAM.fat,
    proteinG,
    carbsG,
    fatG,
  };
}

/** Une part d'énergie est-elle dans la fourchette ANSES ? */
export function withinAnses(macro: MacroKey, share: number): boolean {
  const [min, max] = ANSES_RANGES[macro];
  return share >= min && share <= max;
}
