/**
 * La progression — bibliothèque pure (docs/etude-sport.md §5, §12, §17).
 *
 * Tout se recalcule depuis les sorties, rien n'est rangé. Le temps est
 * découpé en tranches régulières (semaines sur trois ou six mois, mois
 * au-delà) : chaque point d'une courbe pèse le même temps, la pente ne ment
 * pas (le défaut des courbes d'Objectifs corrigé le 06/10/2026).
 */
import { mondayOf, shiftDay } from '../../../core/lib/day';
import { paceOf, riegel } from './pace';
import { RECORD_DISTANCES, bestEfforts, recentReference, type Effort } from './stats';
import { MARATHON_M, type Run, type RunKind } from './types';
import { zoneOf, type HrZone } from './zones';

export const PERIODS = ['3m', '6m', '1a', 'tout'] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = { '3m': '3 mois', '6m': '6 mois', '1a': '1 an', tout: 'Tout' };

/** Une tranche de temps : `[start, end[`. */
export interface Bucket {
  start: string;
  end: string;
  unit: 'semaine' | 'mois';
}

const firstOfMonth = (day: string) => `${day.slice(0, 7)}-01`;
function nextMonth(day: string): string {
  const [y, m] = day.split('-').map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}
function monthsBack(day: string, n: number): string {
  const [y, m] = day.split('-').map(Number);
  const total = y * 12 + (m - 1) - n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
}

/**
 * Les tranches de la période, la dernière contenant `today` : 13 ou 26
 * semaines, 12 mois, ou tous les mois depuis la première sortie (12 au moins).
 */
export function buckets(period: Period, today: string, runs: Pick<Run, 'day'>[] = []): Bucket[] {
  if (period === '3m' || period === '6m') {
    const n = period === '3m' ? 13 : 26;
    const last = mondayOf(today);
    return Array.from({ length: n }, (_, i) => {
      const start = shiftDay(last, -7 * (n - 1 - i));
      return { start, end: shiftDay(start, 7), unit: 'semaine' as const };
    });
  }
  const lastMonth = firstOfMonth(today);
  let first = monthsBack(lastMonth, 11);
  if (period === 'tout' && runs.length > 0) {
    const earliest = firstOfMonth(runs.reduce((m, r) => (r.day < m ? r.day : m), runs[0].day));
    if (earliest < first) first = earliest;
  }
  const out: Bucket[] = [];
  for (let start = first; start <= lastMonth; start = nextMonth(start)) out.push({ start, end: nextMonth(start), unit: 'mois' });
  return out;
}

const inside = (r: Pick<Run, 'day'>, b: { start: string; end: string }) => r.day >= b.start && r.day < b.end;

export interface Totals {
  distanceM: number;
  durationS: number;
  runs: number;
  elevationM: number;
}

export function totals(runs: Run[], from: string, to: string): Totals {
  const inRange = runs.filter((r) => inside(r, { start: from, end: to }));
  return {
    distanceM: inRange.reduce((s, r) => s + r.distanceM, 0),
    durationS: inRange.reduce((s, r) => s + r.durationS, 0),
    runs: inRange.length,
    elevationM: inRange.reduce((s, r) => s + (r.elevationM ?? 0), 0),
  };
}

export interface VolumePoint extends Bucket {
  distanceM: number;
  runs: number;
}

export function volumes(runs: Run[], list: Bucket[]): VolumePoint[] {
  return list.map((b) => {
    const t = totals(runs, b.start, b.end);
    return { ...b, distanceM: t.distanceM, runs: t.runs };
  });
}

/**
 * La période d'avant, de même longueur : de quoi dire « +12 % ». `null`
 * quand rien n'y a été couru, ou quand l'historique ne la couvre pas en
 * entier — comparer à zéro, ou à quelques semaines, ne dirait rien.
 */
export function previousTotals(runs: Run[], list: Bucket[]): Totals | null {
  const from = list[0].start;
  const span = Math.round((Date.parse(list[list.length - 1].end) - Date.parse(from)) / 86_400_000);
  const prevStart = shiftDay(from, -span);
  // Un historique qui commence au milieu de la période d'avant la ferait
  // paraître maigre (« +1369 % ») : on ne compare qu'à une période couverte.
  const earliest = runs.reduce<string | null>((m, r) => (m === null || r.day < m ? r.day : m), null);
  if (earliest === null || earliest > shiftDay(prevStart, 14)) return null;
  const prev = totals(runs, prevStart, from);
  return prev.runs > 0 ? prev : null;
}

export interface PacePoint extends Bucket {
  /** Allure moyenne pondérée par la distance, `null` sans sortie de cette sorte. */
  paceS: number | null;
  distanceM: number;
}

/**
 * L'allure d'une sorte de sortie, tranche par tranche : un footing qui passe
 * de 6:10 à 5:45 /km se voit ici. Toutes sortes confondues, la courbe
 * mêlerait fractionnés et footings et ne dirait rien.
 */
export function paceTrend(runs: Run[], list: Bucket[], kinds: readonly RunKind[]): PacePoint[] {
  return list.map((b) => {
    const these = runs.filter((r) => inside(r, b) && kinds.includes(r.kind) && r.distanceM > 0);
    const distanceM = these.reduce((s, r) => s + r.distanceM, 0);
    const durationS = these.reduce((s, r) => s + r.durationS, 0);
    return { ...b, paceS: distanceM > 0 ? paceOf(distanceM, durationS) : null, distanceM };
  });
}

/**
 * L'endurance (§12) : l'allure des footings et sorties longues courus en
 * zone 2. Une sortie sans FC moyenne n'y entre pas.
 */
export function zone2Trend(runs: Run[], list: Bucket[], zones: HrZone[] | null): PacePoint[] {
  const easy = runs.filter((r) => r.avgHr !== null && zoneOf(r.avgHr, zones) === 2);
  return paceTrend(easy, list, ['footing', 'longue']);
}

/**
 * Ce qu'a changé l'allure : la moyenne des trois premières tranches qui ont
 * une valeur contre celle des trois dernières. Négatif = plus rapide. `null`
 * sans six tranches renseignées : moins, ce serait du bruit.
 */
export function paceChange(points: PacePoint[]): { fromS: number; toS: number; deltaS: number } | null {
  const known = points.filter((p): p is PacePoint & { paceS: number } => p.paceS !== null);
  if (known.length < 6) return null;
  const avg = (ps: typeof known) => {
    const d = ps.reduce((s, p) => s + p.distanceM, 0);
    return ps.reduce((s, p) => s + p.paceS * p.distanceM, 0) / d;
  };
  const fromS = Math.round(avg(known.slice(0, 3)));
  const toS = Math.round(avg(known.slice(-3)));
  return { fromS, toS, deltaS: toS - fromS };
}

export interface ZonePoint extends Bucket {
  /** Secondes courues dans chaque zone (index 0 = zone 1), d'après la FC MOYENNE de chaque sortie. */
  byZone: number[];
  /** Secondes de sorties sans FC, ou sous la zone 1. */
  unknownS: number;
}

/**
 * Le temps par zone. Une approximation dite comme telle : chaque sortie
 * compte tout entière dans la zone de sa FC moyenne (le détail seconde par
 * seconde demanderait le fichier de chaque sortie).
 */
export function zoneTime(runs: Run[], list: Bucket[], zones: HrZone[] | null): ZonePoint[] {
  return list.map((b) => {
    const byZone = [0, 0, 0, 0, 0];
    let unknownS = 0;
    for (const r of runs.filter((x) => inside(x, b))) {
      const z = r.avgHr !== null ? zoneOf(r.avgHr, zones) : null;
      if (z === null) unknownS += r.durationS;
      else byZone[z - 1] += r.durationS;
    }
    return { ...b, byZone, unknownS };
  });
}

/** La part du temps facile (zones 1 et 2) parmi le temps dont on connaît la zone ; `null` sans FC. */
export function easyShare(points: ZonePoint[]): number | null {
  const all = points.reduce((s, p) => s + p.byZone.reduce((a, v) => a + v, 0), 0);
  if (all === 0) return null;
  const easy = points.reduce((s, p) => s + p.byZone[0] + p.byZone[1], 0);
  return easy / all;
}

/**
 * L'histoire des records : sortie après sortie, chaque fois qu'un meilleur
 * temps tombe sur une distance. Le dernier de chaque liste est le record
 * d'aujourd'hui (le même que `bestEfforts`).
 */
export function recordHistory(runs: Run[]): Map<number, Effort[]> {
  const sorted = runs.slice().sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const history = new Map<number, Effort[]>(RECORD_DISTANCES.map((d) => [d, []]));
  for (const run of sorted) {
    for (const effort of bestEfforts([run])) {
      const list = history.get(effort.distanceM)!;
      const current = list[list.length - 1];
      if (!current || effort.timeS < current.timeS) list.push(effort);
    }
  }
  for (const [d, list] of history) if (list.length === 0) history.delete(d);
  return history;
}

export interface PredictionPoint extends Bucket {
  /** Le marathon prédit à la fin de la tranche, d'après le meilleur effort des 90 jours d'avant. */
  timeS: number | null;
}

/**
 * La prédiction au marathon, tranche après tranche (formule de Riegel, une
 * estimation) : la même règle que le plan (`recentReference`), rejouée à la
 * fin de chaque tranche. Une tranche dans l'avenir n'a pas de prédiction.
 */
export function predictionTrend(runs: Run[], list: Bucket[], today: string): PredictionPoint[] {
  return list.map((b) => {
    const at = b.end > today ? today : shiftDay(b.end, -1);
    const ref = recentReference(runs, at);
    return { ...b, timeS: ref ? Math.round(riegel(ref.distanceM, ref.timeS, MARATHON_M)) : null };
  });
}
