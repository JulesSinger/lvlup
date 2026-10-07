/**
 * Ce que disent les sorties, semaine après semaine — bibliothèque pure
 * (docs/etude-sport.md §4.2, §5, §12).
 */
import { mondayOf, shiftDay } from '../../../core/lib/day';
import { paceOf } from './pace';
import { HALF_MARATHON_M, MARATHON_M, type Run } from './types';
import { zoneOf, type HrZone } from './zones';

export interface WeekVolume {
  /** Lundi de la semaine. */
  monday: string;
  distanceM: number;
  durationS: number;
  runs: number;
}

/** Les `weeks` dernières semaines, la dernière contenant `today`, semaines vides comprises. */
export function weeklyVolumes(runs: Run[], today: string, weeks = 12): WeekVolume[] {
  const last = mondayOf(today);
  const out: WeekVolume[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = shiftDay(last, -7 * i);
    const end = shiftDay(monday, 7);
    const inWeek = runs.filter((r) => r.day >= monday && r.day < end);
    out.push({
      monday,
      distanceM: inWeek.reduce((s, r) => s + r.distanceM, 0),
      durationS: inWeek.reduce((s, r) => s + r.durationS, 0),
      runs: inWeek.length,
    });
  }
  return out;
}

/** Le volume moyen des quatre semaines PLEINES avant celle de `today` : de quoi partir pour le plan. */
export function recentWeeklyAverage(runs: Run[], today: string): number {
  const weeks = weeklyVolumes(runs, shiftDay(mondayOf(today), -7), 4);
  return Math.round(weeks.reduce((s, w) => s + w.distanceM, 0) / weeks.length);
}

/** La plus longue sortie des huit dernières semaines. */
export function longestRecent(runs: Run[], today: string): number {
  const since = shiftDay(today, -56);
  return runs.filter((r) => r.day >= since && r.day <= today).reduce((m, r) => Math.max(m, r.distanceM), 0);
}

/** Les distances dont on garde le record (§4.2). */
export const RECORD_DISTANCES = [1000, 5000, 10_000, HALF_MARATHON_M, MARATHON_M] as const;

export interface Effort {
  distanceM: number;
  timeS: number;
  runId: string;
  day: string;
  /** Une sortie entière de cette distance, ou un morceau d'une sortie plus longue (temps au km). */
  within: boolean;
}

/**
 * Le meilleur temps sur chaque distance :
 * - une sortie entière de cette distance, à 3 % près (un 10 km mesuré
 *   10,08 km est un 10 km) — son temps ramené à la distance exacte ;
 * - avec les temps au kilomètre, les `k` kilomètres consécutifs les plus
 *   rapides d'une sortie plus longue (1, 5 et 10 km seulement : le semi et
 *   le marathon ne tombent pas sur un nombre entier de kilomètres).
 */
export function bestEfforts(runs: Run[]): Effort[] {
  const best = new Map<number, Effort>();
  const offer = (effort: Effort) => {
    const current = best.get(effort.distanceM);
    if (!current || effort.timeS < current.timeS) best.set(effort.distanceM, effort);
  };
  for (const run of runs) {
    for (const d of RECORD_DISTANCES) {
      if (run.distanceM >= d && run.distanceM <= d * 1.03) {
        offer({ distanceM: d, timeS: Math.round(run.durationS * (d / run.distanceM)), runId: run.id, day: run.day, within: false });
      }
      const k = d / 1000;
      const splits = run.splitsS;
      // Une sortie de cette distance compte déjà entière, juste au-dessus.
      if (!Number.isInteger(k) || !splits || splits.length < k || run.distanceM <= d * 1.03) continue;
      let sum = splits.slice(0, k).reduce((s, v) => s + v, 0);
      let min = sum;
      for (let i = k; i < splits.length; i++) {
        sum += splits[i] - splits[i - k];
        min = Math.min(min, sum);
      }
      offer({ distanceM: d, timeS: min, runId: run.id, day: run.day, within: true });
    }
  }
  return RECORD_DISTANCES.flatMap((d) => (best.has(d) ? [best.get(d)!] : []));
}

/**
 * Le meilleur effort récent qui servira de temps de référence au plan : le
 * plus récent des records sur 5 km, 10 km ou semi des `days` derniers jours,
 * en préférant la plus longue distance (elle prédit mieux un marathon).
 */
export function recentReference(runs: Run[], today: string, days = 90): { distanceM: number; timeS: number; day: string } | null {
  const since = shiftDay(today, -days);
  const efforts = bestEfforts(runs.filter((r) => r.day >= since && r.day <= today));
  for (const d of [HALF_MARATHON_M, 10_000, 5000]) {
    const e = efforts.find((x) => x.distanceM === d);
    if (e) return { distanceM: d, timeS: e.timeS, day: e.day };
  }
  return null;
}

export interface EndurancePoint {
  monday: string;
  /** L'allure moyenne des footings et sorties longues courus en zone 2, pondérée par la distance. */
  paceS: number | null;
  distanceM: number;
}

/**
 * L'indicateur d'endurance (§12) : l'allure en zone 2, semaine après semaine.
 * Courir plus vite au même cœur est la progression la plus honnête d'une
 * préparation marathon. Une sortie sans FC moyenne n'entre pas dans le calcul.
 */
export function zone2Paces(runs: Run[], zones: HrZone[] | null, today: string, weeks = 12): EndurancePoint[] {
  return weeklyVolumes([], today, weeks).map(({ monday }) => {
    const end = shiftDay(monday, 7);
    const easy = runs.filter(
      (r) =>
        r.day >= monday &&
        r.day < end &&
        (r.kind === 'footing' || r.kind === 'longue') &&
        r.avgHr !== null &&
        zoneOf(r.avgHr, zones) === 2,
    );
    const distanceM = easy.reduce((s, r) => s + r.distanceM, 0);
    const durationS = easy.reduce((s, r) => s + r.durationS, 0);
    return { monday, paceS: distanceM > 0 ? paceOf(distanceM, durationS) : null, distanceM };
  });
}
