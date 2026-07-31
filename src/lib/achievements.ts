import { profilePP, profileRank } from './progress';
import { getRank } from './ranks';
import { computeStreak } from './streak';
import type { Checkin, Goal } from './types';

/**
 * Trophées — tous calculés depuis les données, rien à stocker.
 * Deux familles (leçon Duolingo) : les « base » se débloquent vite et donnent
 * des victoires immédiates, les « rare » récompensent le long terme.
 */

export interface AchievementDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
  family: 'base' | 'rare';
}

export interface AchievementContext {
  goals: Goal[];
  checkins: Checkin[];
}

interface InternalDef extends AchievementDef {
  test: (ctx: EvaluatedContext) => boolean;
}

interface EvaluatedContext extends AchievementContext {
  pp: number;
  bestStreak: number;
  completedTiers: number;
  completedGoals: number;
}

const DEFS: InternalDef[] = [
  // --- Base : atteignables dès les premiers jours -----------------------
  {
    id: 'premier-pas',
    icon: '👣',
    name: 'Premier pas',
    desc: 'Faire son premier check-in quotidien.',
    family: 'base',
    test: (c) => c.checkins.length >= 1,
  },
  {
    id: 'premier-sang',
    icon: '⚔️',
    name: 'Premier sang',
    desc: 'Valider son premier palier.',
    family: 'base',
    test: (c) => c.completedTiers >= 1,
  },
  {
    id: 'stratege',
    icon: '🗺️',
    name: 'Stratège',
    desc: 'Mener 3 objectifs de front.',
    family: 'base',
    test: (c) => c.goals.filter((g) => !g.archived).length >= 3,
  },
  {
    id: 'semaine-parfaite',
    icon: '🔥',
    name: 'Semaine parfaite',
    desc: "7 jours d'activité d'affilée.",
    family: 'base',
    test: (c) => c.bestStreak >= 7,
  },
  {
    id: 'perfect-game',
    icon: '🏁',
    name: 'Perfect game',
    desc: 'Accomplir un objectif de bout en bout.',
    family: 'base',
    test: (c) => c.completedGoals >= 1,
  },
  {
    id: 'tresorier',
    icon: '💰',
    name: 'Trésorier',
    desc: 'Cumuler 500 PP.',
    family: 'base',
    test: (c) => c.pp >= 500,
  },
  // --- Rare : le long terme --------------------------------------------
  {
    id: 'en-fusion',
    icon: '🌋',
    name: 'En fusion',
    desc: "30 jours d'activité d'affilée.",
    family: 'rare',
    test: (c) => c.bestStreak >= 30,
  },
  {
    id: 'inarretable',
    icon: '☄️',
    name: 'Inarrêtable',
    desc: "100 jours d'activité d'affilée.",
    family: 'rare',
    test: (c) => c.bestStreak >= 100,
  },
  {
    id: 'fortune-de-guerre',
    icon: '👑',
    name: 'Fortune de guerre',
    desc: 'Cumuler 2 000 PP.',
    family: 'rare',
    test: (c) => c.pp >= 2000,
  },
  {
    id: 'challenger',
    icon: '🏆',
    name: 'Challenger',
    desc: 'Valider un palier de rang Challenger.',
    family: 'rare',
    test: (c) =>
      c.goals.some((g) =>
        g.tiers.some((t) => t.completedAt && getRank(t.rank).id === 'challenger'),
      ),
  },
  {
    id: 'ligue-doree',
    icon: '🥇',
    name: 'Ligue dorée',
    desc: 'Atteindre le rang de profil Or.',
    family: 'rare',
    test: (c) => {
      const { rank } = profileRank(c.goals);
      return rank !== null && rank.value >= 4;
    },
  },
  {
    id: 'regulier',
    icon: '📆',
    name: 'Régulier',
    desc: 'Faire 50 check-ins au total.',
    family: 'rare',
    test: (c) => c.checkins.length >= 50,
  },
];

export const ACHIEVEMENTS: AchievementDef[] = DEFS.map(({ test: _test, ...def }) => def);

/** Ids des trophées débloqués dans l'état donné. */
export function unlockedAchievements(ctx: AchievementContext): Set<string> {
  const active = ctx.goals.filter((g) => !g.archived);
  const evaluated: EvaluatedContext = {
    ...ctx,
    pp: profilePP(ctx.goals, ctx.checkins),
    bestStreak: computeStreak(ctx.goals, ctx.checkins).best,
    completedTiers: active.reduce(
      (n, g) => n + g.tiers.filter((t) => t.completedAt).length,
      0,
    ),
    completedGoals: active.filter(
      (g) => g.tiers.length > 0 && g.tiers.every((t) => t.completedAt),
    ).length,
  };
  return new Set(DEFS.filter((def) => def.test(evaluated)).map((def) => def.id));
}

/** Trophées présents dans `after` mais pas dans `before`. */
export function newlyUnlocked(
  before: AchievementContext,
  after: AchievementContext,
): AchievementDef[] {
  const was = unlockedAchievements(before);
  const now = unlockedAchievements(after);
  return ACHIEVEMENTS.filter((def) => now.has(def.id) && !was.has(def.id));
}
