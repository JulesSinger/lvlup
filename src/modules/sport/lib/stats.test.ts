import { describe, expect, it } from 'vitest';
import { bestEfforts, longestRecent, recentReference, recentWeeklyAverage, weeklyVolumes, zone2Paces } from './stats';
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

// Mercredi 7 octobre 2026.
const today = '2026-10-07';

describe('le volume par semaine', () => {
  it('compte chaque semaine, vides comprises, la dernière contenant aujourd’hui', () => {
    const weeks = weeklyVolumes([run('2026-10-05', 8, 45), run('2026-10-06', 10, 55), run('2026-09-30', 12, 70)], today, 3);
    expect(weeks.map((w) => w.monday)).toEqual(['2026-09-21', '2026-09-28', '2026-10-05']);
    expect(weeks.map((w) => w.distanceM)).toEqual([0, 12_000, 18_000]);
    expect(weeks[2].runs).toBe(2);
  });

  it('la moyenne des quatre semaines pleines d’avant, et la plus longue sortie récente', () => {
    const runs = [run('2026-09-07', 20, 120), run('2026-09-14', 20, 120), run('2026-09-21', 20, 120), run('2026-09-28', 20, 120), run('2026-10-06', 30, 200)];
    expect(recentWeeklyAverage(runs, today)).toBe(20_000);
    expect(longestRecent(runs, today)).toBe(30_000);
  });
});

describe('les records', () => {
  it('une sortie entière de la distance, à 3 % près, ramenée à la distance exacte', () => {
    const efforts = bestEfforts([run('2026-09-01', 10.08, 50.4), run('2026-09-10', 10.5, 50)]);
    const ten = efforts.find((e) => e.distanceM === 10_000)!;
    expect(ten.timeS).toBe(3000);
    expect(ten.within).toBe(false);
  });

  it('les kilomètres les plus rapides d’une sortie plus longue, avec les temps au km', () => {
    const splits = [320, 310, 300, 290, 300, 330, 340];
    const efforts = bestEfforts([run('2026-09-01', 7, 36.5, { splitsS: splits })]);
    expect(efforts.find((e) => e.distanceM === 1000)).toMatchObject({ timeS: 290, within: true });
    expect(efforts.find((e) => e.distanceM === 5000)).toMatchObject({ timeS: 1520, within: true });
    expect(efforts.find((e) => e.distanceM === 10_000)).toBeUndefined();
  });

  it('le temps de référence : le plus long effort récent parmi semi, 10 km et 5 km', () => {
    const runs = [run('2026-09-20', 5, 24), run('2026-09-27', 10, 51), run('2026-03-01', 21.1, 110)];
    expect(recentReference(runs, today)).toEqual({ distanceM: 10_000, timeS: 3060 });
    expect(recentReference([], today)).toBeNull();
  });
});

describe('l’endurance en zone 2', () => {
  it('l’allure des footings courus en zone 2, pondérée par la distance', () => {
    const zones = hrZones({ hrMax: 190, hrRest: 50 });
    const runs = [
      run('2026-10-05', 10, 60, { avgHr: 140 }),
      run('2026-10-06', 5, 27.5, { avgHr: 142, kind: 'longue' }),
      run('2026-10-06', 6, 30, { avgHr: 165 }), // zone 4 : écarté
      run('2026-10-06', 8, 40, { avgHr: 140, kind: 'seuil' }), // pas un footing : écarté
      run('2026-10-06', 8, 40), // pas de FC : écarté
    ];
    const points = zone2Paces(runs, zones, today, 2);
    expect(points[0].paceS).toBeNull();
    expect(points[1]).toEqual({ monday: '2026-10-05', paceS: 350, distanceM: 15_000 });
  });
});
