/**
 * La cadence — bibliothèque pure (demande de Jules, 17/10/2026 : « l'analyse
 * de la cadence (ppm) »).
 *
 * Toujours en PAS PAR MINUTE, les deux pieds. Strava et les fichiers FIT
 * comptent souvent une seule jambe (les « foulées » : 85 pour 170 ppm) ; tout
 * ce qui entre passe par `stepsPerMinute`, qui double une valeur manifestement
 * comptée sur une jambe. Personne ne court sous 120 pas par minute ; personne
 * ne court à 240 foulées d'une jambe.
 *
 * La règle est recopiée dans `supabase/functions/sport-strava/strava.ts`
 * (Deno ne lit pas `src/`) : `stravaApi.test.ts` compare les deux.
 */
import { paceOf } from './pace';
import type { Bucket } from './progress';
import type { Run, RunKind } from './types';

/** Les bornes de la base (`sport_runs_avg_cadence_check`). */
export const CADENCE_MIN = 100;
export const CADENCE_MAX = 260;
/** Sous ce nombre, une cadence est comptée sur une jambe. */
const ONE_LEG_BELOW = 125;

/** Une cadence lue quelque part, en pas par minute ; `null` si elle ne veut rien dire. */
export function stepsPerMinute(raw: unknown): number | null {
  const v = typeof raw === 'string' ? Number(raw.replace(',', '.')) : raw;
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
  const steps = Math.round(v < ONE_LEG_BELOW ? v * 2 : v);
  return steps >= CADENCE_MIN && steps <= CADENCE_MAX ? steps : null;
}

type WithCadence = Run & { avgCadence: number };
const withCadence = (runs: readonly Run[]): WithCadence[] => runs.filter((r): r is WithCadence => r.avgCadence !== null && r.durationS > 0);

/** La moyenne pondérée par le temps couru : une sortie d'une heure pèse plus qu'un 20 minutes. */
function weighted(runs: readonly WithCadence[]): number | null {
  const time = runs.reduce((s, r) => s + r.durationS, 0);
  return time > 0 ? Math.round(runs.reduce((s, r) => s + r.avgCadence * r.durationS, 0) / time) : null;
}

export interface CadencePoint extends Bucket {
  cadence: number | null;
  runs: number;
}

/** La cadence tranche par tranche, pour les sortes données (toutes sinon). */
export function cadenceTrend(runs: readonly Run[], list: Bucket[], kinds?: readonly RunKind[]): CadencePoint[] {
  const known = withCadence(runs).filter((r) => !kinds || kinds.includes(r.kind));
  return list.map((b) => {
    const these = known.filter((r) => r.day >= b.start && r.day < b.end);
    return { ...b, cadence: weighted(these), runs: these.length };
  });
}

/**
 * Ce qu'a changé la cadence : les trois premières tranches renseignées contre
 * les trois dernières ; `null` sans six tranches (moins, ce serait du bruit).
 */
export function cadenceChange(points: CadencePoint[]): { from: number; to: number; delta: number } | null {
  const known = points.filter((p): p is CadencePoint & { cadence: number } => p.cadence !== null);
  if (known.length < 6) return null;
  const mean = (xs: typeof known) => Math.round(xs.reduce((s, p) => s + p.cadence, 0) / xs.length);
  const from = mean(known.slice(0, 3));
  const to = mean(known.slice(-3));
  return { from, to, delta: to - from };
}

export interface CadenceSummary {
  /** Moyenne pondérée par le temps. */
  average: number;
  lowest: number;
  highest: number;
  runs: number;
}

export function cadenceSummary(runs: readonly Run[], from: string, to: string): CadenceSummary | null {
  const these = withCadence(runs).filter((r) => r.day >= from && r.day < to);
  const average = weighted(these);
  if (average === null) return null;
  const values = these.map((r) => r.avgCadence);
  return { average, lowest: Math.min(...values), highest: Math.max(...values), runs: these.length };
}

/** Les tranches d'allure, en secondes par km : la cadence monte avec la vitesse, on compare à allure égale. */
const PACE_BANDS: [number, number][] = [
  [0, 270],
  [270, 300],
  [300, 330],
  [330, 360],
  [360, 390],
  [390, Infinity],
];

export interface PaceBand {
  /** Bornes de l'allure, `[de, à[` en s/km. */
  fromS: number;
  toS: number;
  cadence: number;
  runs: number;
}

/**
 * La cadence à allure égale : par tranche de 30 s/km, de la plus rapide à la
 * plus lente. Plus parlant qu'une moyenne qui mêle fractionnés et footings —
 * et c'est ici qu'une cadence qui progresse se voit vraiment.
 */
export function cadenceByPace(runs: readonly Run[], from: string, to: string): PaceBand[] {
  const these = withCadence(runs).filter((r) => r.day >= from && r.day < to && r.distanceM > 0);
  const out: PaceBand[] = [];
  for (const [lo, hi] of PACE_BANDS) {
    const band = these.filter((r) => {
      const pace = paceOf(r.distanceM, r.durationS);
      return pace !== null && pace >= lo && pace < hi;
    });
    const cadence = weighted(band);
    if (cadence !== null) out.push({ fromS: lo, toS: hi, cadence, runs: band.length });
  }
  return out;
}

/**
 * La longueur moyenne d'un pas, en centimètres : la vitesse divisée par la
 * cadence. Avec la cadence, c'est l'autre moitié de l'allure — plus vite,
 * c'est plus de pas, ou des pas plus longs.
 */
export function strideCm(run: Pick<Run, 'distanceM' | 'durationS' | 'avgCadence'>): number | null {
  if (!run.avgCadence || run.durationS <= 0 || run.distanceM <= 0) return null;
  return Math.round(((run.distanceM / (run.durationS / 60)) / run.avgCadence) * 100);
}
