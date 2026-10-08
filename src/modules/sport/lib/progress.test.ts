import { describe, expect, it } from 'vitest';
import {
  buckets,
  easyShare,
  paceChange,
  paceTrend,
  predictionTrend,
  previousTotals,
  recordHistory,
  totals,
  volumes,
  zone2Trend,
  zoneTime,
} from './progress';
import type { Run } from './types';
import { hrZones } from './zones';

let n = 0;
const run = (day: string, km: number, minutes: number, extra: Partial<Run> = {}): Run => ({
  id: `r${n++}`,
  startedAt: `${day}T07:00:00.000Z`,
  day,
  distanceM: Math.round(km * 1000),
  durationS: Math.round(minutes * 60),
  elevationM: null,
  avgHr: null,
  maxHr: null,
  kind: 'footing',
  effort: null,
  title: '',
  note: '',
  source: 'manuel',
  sourceRef: null,
  sessionId: null,
  splitsS: null,
  createdAt: '',
  ...extra,
});

// Jeudi 8 octobre 2026.
const today = '2026-10-08';
const zones = hrZones({ hrMax: 190, hrRest: 50 });

describe('les tranches de temps', () => {
  it('des semaines sur trois et six mois, la dernière contenant aujourd’hui', () => {
    const w = buckets('3m', today);
    expect(w).toHaveLength(13);
    expect(w[12]).toEqual({ start: '2026-10-05', end: '2026-10-12', unit: 'semaine' });
    expect(w[0].start).toBe('2026-07-13');
    expect(buckets('6m', today)).toHaveLength(26);
  });

  it('des mois sur un an, et depuis la première sortie pour « tout »', () => {
    const y = buckets('1a', today);
    expect(y).toHaveLength(12);
    expect(y[0]).toEqual({ start: '2025-11-01', end: '2025-12-01', unit: 'mois' });
    expect(y[11]).toEqual({ start: '2026-10-01', end: '2026-11-01', unit: 'mois' });
    const all = buckets('tout', today, [run('2024-12-30', 5, 30)]);
    expect(all[0].start).toBe('2024-12-01');
    expect(all[1].start).toBe('2025-01-01');
    expect(all).toHaveLength(23);
    // Un historique court garde douze mois : une courbe de trois points ne dirait rien.
    expect(buckets('tout', today, [run('2026-09-01', 5, 30)])).toHaveLength(12);
  });
});

describe('le volume', () => {
  const runs = [run('2026-10-05', 10, 55), run('2026-10-07', 8, 44, { elevationM: 60 }), run('2026-09-20', 21.1, 115)];

  it('par tranche, et au total', () => {
    const v = volumes(runs, buckets('3m', today));
    expect(v[12]).toMatchObject({ distanceM: 18_000, runs: 2 });
    expect(v[9]).toMatchObject({ start: '2026-09-14', distanceM: 21_100, runs: 1 });
    expect(totals(runs, '2026-10-01', '2026-11-01')).toEqual({ distanceM: 18_000, durationS: 5940, runs: 2, elevationM: 60 });
  });

  it('comparé à la période d’avant, seulement si on y a couru', () => {
    const list = buckets('3m', today);
    expect(previousTotals(runs, list)).toBeNull();
    const prev = previousTotals([...runs, run('2026-04-15', 12, 70)], list);
    expect(prev).toMatchObject({ distanceM: 12_000, runs: 1 });
    // Un historique qui commence au milieu de la période d'avant : pas de comparaison.
    expect(previousTotals([...runs, run('2026-06-20', 12, 70)], list)).toBeNull();
  });
});

describe('l’allure', () => {
  it('par sorte, pondérée par la distance', () => {
    const runs = [run('2026-10-05', 10, 60), run('2026-10-06', 5, 27.5), run('2026-10-06', 6, 24, { kind: 'fractionne' })];
    const p = paceTrend(runs, buckets('3m', today), ['footing']);
    expect(p[12]).toMatchObject({ paceS: 350, distanceM: 15_000 });
    expect(p[11].paceS).toBeNull();
  });

  it('l’endurance : les footings et sorties longues courus en zone 2 seulement', () => {
    const runs = [
      run('2026-10-05', 10, 60, { avgHr: 140 }),
      run('2026-10-06', 5, 27.5, { avgHr: 142, kind: 'longue' }),
      run('2026-10-06', 6, 30, { avgHr: 165 }), // zone 4 : écarté
      run('2026-10-06', 8, 40, { avgHr: 140, kind: 'seuil' }), // pas un footing : écarté
      run('2026-10-06', 8, 40), // pas de FC : écarté
    ];
    const p = zone2Trend(runs, buckets('3m', today), zones);
    expect(p[12]).toMatchObject({ paceS: 350, distanceM: 15_000 });
    expect(zone2Trend(runs, buckets('3m', today), null)[12].paceS).toBeNull();
  });

  it('ce qui a changé : trois tranches du début contre trois de la fin', () => {
    const pts = [400, 380, 390, null, 370, 360, 350].map((paceS, i) => ({
      start: `2026-0${i + 1}-01`,
      end: '',
      unit: 'mois' as const,
      paceS,
      distanceM: 10_000,
    }));
    expect(paceChange(pts)).toEqual({ fromS: 390, toS: 360, deltaS: -30 });
    expect(paceChange(pts.slice(0, 5))).toBeNull();
  });
});

describe('les zones', () => {
  it('chaque sortie compte dans la zone de sa FC moyenne', () => {
    const runs = [run('2026-10-05', 10, 60, { avgHr: 140 }), run('2026-10-06', 6, 30, { avgHr: 165 }), run('2026-10-07', 5, 30)];
    const z = zoneTime(runs, buckets('3m', today), zones)[12];
    expect(z.byZone).toEqual([0, 3600, 0, 1800, 0]);
    expect(z.unknownS).toBe(1800);
    expect(easyShare([z])).toBeCloseTo(2 / 3);
    expect(easyShare(zoneTime(runs, buckets('3m', today), null))).toBeNull();
  });
});

describe('les records et la prédiction', () => {
  const runs = [
    run('2026-06-10', 10, 55),
    run('2026-07-12', 5, 26),
    run('2026-08-15', 10, 52),
    run('2026-09-01', 10, 53), // moins bien : pas un record
    run('2026-09-20', 10.05, 50),
  ];

  it('chaque fois qu’un meilleur temps tombe, dans l’ordre', () => {
    const h = recordHistory(runs);
    expect(h.get(10_000)!.map((e) => [e.day, e.timeS])).toEqual([
      ['2026-06-10', 3300],
      ['2026-08-15', 3120],
      ['2026-09-20', 2985],
    ]);
    expect(h.get(5000)!.map((e) => e.day)).toEqual(['2026-07-12']);
    expect(h.has(42_195)).toBe(false);
  });

  it('le marathon prédit à la fin de chaque mois, d’après les 90 jours d’avant', () => {
    const p = predictionTrend(runs, buckets('1a', today), today);
    const byMonth = Object.fromEntries(p.map((x) => [x.start.slice(0, 7), x.timeS]));
    expect(byMonth['2026-05']).toBeNull();
    // Fin juin : le 10 km en 55 min → ≈ 4 h 13.
    expect(byMonth['2026-06']).toBe(Math.round(3300 * (42_195 / 10_000) ** 1.06));
    // Octobre s'arrête à aujourd'hui : le 10 km du 20 septembre.
    expect(byMonth['2026-10']).toBe(Math.round(2985 * (42_195 / 10_000) ** 1.06));
  });
});
