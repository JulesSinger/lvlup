import { describe, expect, it } from 'vitest';
import { cadenceByPace, cadenceChange, cadenceSummary, cadenceTrend, stepsPerMinute, strideCm } from './cadence';
import { buckets } from './progress';
import type { Run } from './types';

let n = 0;
const run = (day: string, km: number, minutes: number, cadence: number | null, extra: Partial<Run> = {}): Run => ({
  id: `r${n++}`, startedAt: `${day}T18:00:00.000Z`, day, distanceM: km * 1000, durationS: minutes * 60, elevationM: null, avgHr: null, maxHr: null,
  avgCadence: cadence, kind: 'footing', effort: null, title: '', note: '', source: 'strava', sourceRef: null, sessionId: null, splitsS: null, createdAt: '', ...extra,
});

describe('la cadence', () => {
  it('se compte en pas, les deux pieds : une valeur d’une jambe est doublée', () => {
    expect(stepsPerMinute(86)).toBe(172);
    expect(stepsPerMinute(86.4)).toBe(173);
    expect(stepsPerMinute(172)).toBe(172);
    expect(stepsPerMinute('84,5')).toBe(169);
    // Ni zéro (un arrêt), ni une valeur qui ne veut rien dire.
    expect(stepsPerMinute(0)).toBeNull();
    expect(stepsPerMinute(30)).toBeNull();
    expect(stepsPerMinute(300)).toBeNull();
    expect(stepsPerMinute(undefined)).toBeNull();
  });

  it('se suit tranche par tranche, pondérée par le temps couru, les sorties sans cadence écartées', () => {
    const list = buckets('3m', '2026-10-17');
    const runs = [run('2026-10-13', 10, 60, 170), run('2026-10-14', 5, 20, 180), run('2026-10-15', 8, 45, null)];
    const points = cadenceTrend(runs, list);
    // (170 × 60 + 180 × 20) / 80 = 172,5 → 173
    expect(points[points.length - 1]).toMatchObject({ cadence: 173, runs: 2 });
    expect(points[0]).toMatchObject({ cadence: null, runs: 0 });
    expect(cadenceTrend(runs, list, ['longue'])[points.length - 1].cadence).toBeNull();
  });

  it('dit son changement seulement avec six tranches renseignées', () => {
    const list = buckets('3m', '2026-10-17');
    const runs = list.slice(0, 6).map((b, i) => run(b.start, 8, 45, 164 + i * 2));
    expect(cadenceChange(cadenceTrend(runs, list))).toEqual({ from: 166, to: 172, delta: 6 });
    expect(cadenceChange(cadenceTrend(runs.slice(0, 5), list))).toBeNull();
  });

  it('se compare à allure égale, et donne la longueur du pas', () => {
    const runs = [run('2026-10-10', 10, 50, 178), run('2026-10-11', 10, 60, 168), run('2026-10-12', 10, 62, 166)];
    // 5:00 /km dans la tranche 5:00–5:30 ; 6:00 et 6:12 dans 6:00–6:30.
    expect(cadenceByPace(runs, '2026-10-01', '2026-10-20')).toEqual([
      { fromS: 300, toS: 330, cadence: 178, runs: 1 },
      { fromS: 360, toS: 390, cadence: 167, runs: 2 },
    ]);
    expect(cadenceSummary(runs, '2026-10-01', '2026-10-20')).toEqual({ average: 170, lowest: 166, highest: 178, runs: 3 });
    // 200 m/min ÷ 178 pas = 112 cm.
    expect(strideCm(runs[0])).toBe(112);
    expect(strideCm({ distanceM: 1000, durationS: 300, avgCadence: null })).toBeNull();
  });
});
