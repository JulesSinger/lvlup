/**
 * La semaine — bibliothèque pure derrière la vue « Semaine » (étape 7,
 * docs/etude-nutrition.md §10) : sept jours, leur total, l'objectif en
 * vigueur chacun, et la moyenne.
 */
import { shiftDay } from './day';
import { targetForDay, totalOf } from './journal';
import type { NutrientValues } from './macros';
import type { Entry, Target } from './types';

export interface WeekDay {
  day: string;
  total: NutrientValues;
  /** L'objectif de ce jour-là, pas celui d'aujourd'hui (étude §6). */
  target: Target | null;
  /** Au moins une entrée notée ce jour-là */
  logged: boolean;
}

export interface WeekSummary {
  days: WeekDay[];
  /** Nombre de jours notés sur les sept */
  loggedDays: number;
  /** Moyenne des jours notés, arrondie ; `null` si aucun */
  average: NutrientValues | null;
}

/** Les sept jours qui finissent par `endDay`, du plus ancien au plus récent. */
export function weekDays(endDay: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftDay(endDay, i - 6));
}

/**
 * La moyenne ne compte que les jours **notés** : un jour oublié n'est pas un
 * jour à 0 kcal, et le compter ferait croire à une semaine de jeûne. Le
 * nombre de jours retenus est affiché à côté, pour que la moyenne se lise
 * honnêtement.
 */
export function weekSummary(entries: readonly Entry[], targets: readonly Target[], endDay: string): WeekSummary {
  const days = weekDays(endDay).map((day) => {
    const ofDay = entries.filter((e) => e.day === day);
    return { day, total: totalOf(ofDay), target: targetForDay(targets, day), logged: ofDay.length > 0 };
  });
  const logged = days.filter((d) => d.logged);
  const average =
    logged.length === 0
      ? null
      : (Object.fromEntries(
          (['kcal', 'proteinDg', 'carbsDg', 'fatDg'] as const).map((k) => [
            k,
            Math.round(logged.reduce((sum, d) => sum + d.total[k], 0) / logged.length),
          ]),
        ) as unknown as NutrientValues);
  return { days, loggedDays: logged.length, average };
}
