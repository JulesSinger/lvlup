import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, unlockedAchievements } from './achievements';
import { shiftDay } from './catchup';
import { bestGoalStreak } from './heatmap';
import { crossedMilestone } from './streak';
import type { Checkin, Goal, Tier } from './types';

const goal = (id: string, tiers: Partial<Tier>[] = []): Goal =>
  ({
    id,
    title: id,
    description: '',
    emoji: '🎯',
    position: 0,
    archived: false,
    createdAt: '2025-01-01T00:00:00Z',
    tiers: tiers.map((t, i) => ({ id: `${id}t${i}`, goalId: id, title: 't', rank: 'fer', position: i, completedAt: null, createdAt: '2025-01-01T00:00:00Z', ...t })),
  }) as Goal;
let n = 0;
const ck = (goalId: string, day: string, note = ''): Checkin =>
  ({ id: `c${n++}`, goalId, actionId: 'a', pp: 10, day, note, createdAt: `${day}T09:00:00Z`, value: null, title: null }) as Checkin;
/** `count` jours consécutifs à partir de `from`. */
const run = (goalId: string, from: string, count: number) =>
  Array.from({ length: count }, (_, i) => ck(goalId, shiftDay(from, i)));

describe('les trophées', () => {
  it('sont vingt, avec des identifiants uniques', () => {
    expect(ACHIEVEMENTS).toHaveLength(20);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(20);
  });

  it('Touche-à-tout : trois objectifs le même jour', () => {
    const goals = [goal('a'), goal('b'), goal('c')];
    expect(unlockedAchievements({ goals, checkins: [ck('a', '2026-10-01'), ck('b', '2026-10-01'), ck('c', '2026-10-02')] }).has('touche-a-tout')).toBe(false);
    expect(unlockedAchievements({ goals, checkins: [ck('a', '2026-10-01'), ck('b', '2026-10-01'), ck('c', '2026-10-01')] }).has('touche-a-tout')).toBe(true);
  });

  it('Carnet de bord : dix notes, les vides ne comptent pas', () => {
    const goals = [goal('a')];
    const neuf = Array.from({ length: 9 }, (_, i) => ck('a', shiftDay('2026-01-01', i), 'fait'));
    expect(unlockedAchievements({ goals, checkins: [...neuf, ck('a', '2026-02-01', '  ')] }).has('carnet')).toBe(false);
    expect(unlockedAchievements({ goals, checkins: [...neuf, ck('a', '2026-02-01', 'dur')] }).has('carnet')).toBe(true);
  });

  it('Le retour : reprendre après au moins sept jours sans rien', () => {
    const goals = [goal('a')];
    // Sept jours vides entre le 1er et le 9.
    expect(unlockedAchievements({ goals, checkins: [ck('a', '2026-10-01'), ck('a', '2026-10-09')] }).has('retour')).toBe(true);
    // Six jours vides seulement.
    expect(unlockedAchievements({ goals, checkins: [ck('a', '2026-10-01'), ck('a', '2026-10-08')] }).has('retour')).toBe(false);
  });

  it('Premier or et Ascension', () => {
    const or = goal('a', [{ rank: 'or', completedAt: '2026-10-01T10:00:00Z' }]);
    expect(unlockedAchievements({ goals: [or], checkins: [] }).has('premier-or')).toBe(true);
    const argent = goal('a', [{ rank: 'argent', completedAt: '2026-10-01T10:00:00Z' }]);
    expect(unlockedAchievements({ goals: [argent], checkins: [] }).has('premier-or')).toBe(false);
    const dix = goal('b', Array.from({ length: 10 }, () => ({ completedAt: '2026-10-01T10:00:00Z' })));
    expect(unlockedAchievements({ goals: [dix], checkins: [] }).has('ascension')).toBe(true);
  });

  it('Fidèle : trente jours d’affilée sur un même objectif, pas tous objectifs confondus', () => {
    const goals = [goal('a'), goal('b')];
    // Un jour sur deux chacun : le streak global tient, celui de chaque objectif non.
    const alternes = Array.from({ length: 40 }, (_, i) => ck(i % 2 ? 'a' : 'b', shiftDay('2026-01-01', i)));
    expect(unlockedAchievements({ goals, checkins: alternes }).has('fidele')).toBe(false);
    expect(unlockedAchievements({ goals, checkins: run('a', '2026-01-01', 30) }).has('fidele')).toBe(true);
  });

  it('Centurion : cent jours sur un même objectif, pas forcément d’affilée', () => {
    const goals = [goal('a')];
    const unSurDeux = Array.from({ length: 100 }, (_, i) => ck('a', shiftDay('2026-01-01', i * 2)));
    expect(unlockedAchievements({ goals, checkins: unSurDeux }).has('centurion')).toBe(true);
    expect(unlockedAchievements({ goals, checkins: unSurDeux.slice(1) }).has('centurion')).toBe(false);
  });
});

describe('bestGoalStreak', () => {
  it('le plus long streak tenu, même s’il est fini', () => {
    const cks = [...run('a', '2026-01-01', 5), ...run('a', '2026-02-01', 3), ck('b', '2026-01-06')];
    expect(bestGoalStreak(goal('a'), cks)).toBe(5);
    expect(bestGoalStreak(goal('c'), cks)).toBe(0);
  });
});

describe('crossedMilestone', () => {
  it('rend le cap franchi, ou rien', () => {
    expect(crossedMilestone(6, 7)).toBe(7);
    expect(crossedMilestone(7, 8)).toBeNull();
    expect(crossedMilestone(29, 30)).toBe(30);
    expect(crossedMilestone(0, 1)).toBeNull();
    // Un rattrapage qui recolle deux séries : le plus haut.
    expect(crossedMilestone(5, 31)).toBe(30);
  });
});
