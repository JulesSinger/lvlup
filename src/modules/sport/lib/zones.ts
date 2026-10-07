/**
 * Les zones de fréquence cardiaque — bibliothèque pure (docs/etude-sport.md §12).
 *
 * Méthode de Karvonen quand la FC de repos est connue : les zones se calculent
 * sur la RÉSERVE cardiaque (max − repos), ce qui tient compte du cœur de
 * chacun. Sans FC de repos, les mêmes pourcentages de la FC maximale.
 * Toujours des chiffres et des zones, jamais un conseil de santé.
 */
import type { Run, SportSettings } from './types';

/** Les bornes basses des zones 1 à 5, en part de la réserve (ou du maximum). */
const ZONE_FLOORS = [0.5, 0.6, 0.7, 0.8, 0.9];

export const ZONE_LABELS = ['Récupération', 'Endurance', 'Tempo', 'Seuil', 'Maximum'] as const;

export interface HrZone {
  zone: number;
  /** Battements par minute, bornes comprises. */
  min: number;
  max: number;
}

/** Les cinq zones, ou `null` tant que la FC maximale n'est pas connue. */
export function hrZones(settings: Pick<SportSettings, 'hrMax' | 'hrRest'>): HrZone[] | null {
  const { hrMax, hrRest } = settings;
  if (!hrMax) return null;
  const base = hrRest ?? 0;
  const span = hrMax - base;
  const at = (share: number) => Math.round(base + span * share);
  return ZONE_FLOORS.map((floor, i) => ({
    zone: i + 1,
    min: at(floor),
    max: i === 4 ? hrMax : at(ZONE_FLOORS[i + 1]) - 1,
  }));
}

/** La zone d'une fréquence ; `null` sans zones, ou sous la zone 1. */
export function zoneOf(hr: number, zones: HrZone[] | null): number | null {
  if (!zones) return null;
  if (hr > zones[4].max) return 5;
  const found = zones.find((z) => hr >= z.min && hr <= z.max);
  return found ? found.zone : null;
}

/**
 * Une FC maximale à proposer : la plus haute vue dans les sorties. Une
 * proposition, jamais une valeur qui remplacerait celle que Jules a saisie.
 */
export function suggestedHrMax(runs: Pick<Run, 'maxHr'>[]): number | null {
  const seen = runs.map((r) => r.maxHr).filter((v): v is number => typeof v === 'number');
  return seen.length > 0 ? Math.max(...seen) : null;
}
