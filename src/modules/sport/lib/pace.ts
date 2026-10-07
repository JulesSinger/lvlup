/**
 * Allures et prédictions — bibliothèque pure (docs/etude-sport.md §4.4, §12).
 *
 * Une allure est toujours CALCULÉE depuis la distance et la durée, jamais
 * rangée : elle ne peut pas les contredire.
 */
import { HALF_MARATHON_M, MARATHON_M, type SessionKind } from './types';

/** L'allure d'une sortie, en secondes par kilomètre ; `null` sous 100 m (rien à dire). */
export function paceOf(distanceM: number, durationS: number): number | null {
  if (distanceM < 100 || durationS <= 0) return null;
  return Math.round(durationS / (distanceM / 1000));
}

/**
 * La formule de Riegel : T2 = T1 × (D2 / D1)^1,06. Connue pour être
 * optimiste sur le marathon quand l'entraînement est court : une estimation,
 * jamais un objectif.
 */
export function riegel(referenceM: number, referenceS: number, targetM: number, exponent = 1.06): number {
  return Math.round(referenceS * (targetM / referenceM) ** exponent);
}

export interface Reference {
  distanceM: number;
  timeS: number;
}

/** Une fourchette d'allures cibles, en secondes par kilomètre, la plus rapide d'abord. */
export interface PaceRange {
  min: number;
  max: number;
}

/**
 * Les allures d'entraînement tirées d'un temps de référence récent. Chaque
 * sorte de séance se règle sur une allure de course prédite :
 * - footing : allure marathon + 45 à 75 s (en aisance, on peut parler) ;
 * - sortie longue : allure marathon + 30 à 60 s ;
 * - allure : l'allure marathon, à ± 5 s ;
 * - seuil : entre l'allure du 10 km et celle du semi ;
 * - fractionné : l'allure du 5 km, à ± 5 s.
 * Des repères connus de la préparation marathon, simples à expliquer.
 */
export function trainingPaces(ref: Reference): Record<Exclude<SessionKind, 'course'>, PaceRange> {
  const per = (meters: number) => riegel(ref.distanceM, ref.timeS, meters) / (meters / 1000);
  const marathon = per(MARATHON_M);
  const half = per(HALF_MARATHON_M);
  const tenK = per(10_000);
  const fiveK = per(5_000);
  const r = (min: number, max: number): PaceRange => ({ min: Math.round(min), max: Math.round(max) });
  return {
    footing: r(marathon + 45, marathon + 75),
    longue: r(marathon + 30, marathon + 60),
    allure: r(marathon - 5, marathon + 5),
    seuil: r(tenK, half),
    fractionne: r(fiveK - 5, fiveK + 5),
  };
}
