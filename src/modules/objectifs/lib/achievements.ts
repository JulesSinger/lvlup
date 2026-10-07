import { shiftDay } from './catchup';
import { bestGoalStreak } from './heatmap';
import { profilePP, profileRank } from './progress';
import { getRank } from './ranks';
import { activityDays, computeStreak } from './streak';
import type { Checkin, Goal } from './types';

/** Jours distincts travaillés sur un objectif. */
function goalDays(goal: Goal, checkins: Checkin[]): number {
  return new Set(checkins.filter((c) => c.goalId === goal.id).map((c) => c.day)).size;
}

/** Au moins un jour où `count` objectifs différents ont été travaillés. */
function sameDayGoals(checkins: Checkin[], count: number): boolean {
  const byDay = new Map<string, Set<string>>();
  for (const c of checkins) {
    const goals = byDay.get(c.day) ?? new Set<string>();
    goals.add(c.goalId);
    byDay.set(c.day, goals);
  }
  return [...byDay.values()].some((goals) => goals.size >= count);
}

/**
 * Revenu après au moins sept jours sans rien : deux jours d'activité qui se
 * suivent dans la liste, séparés d'au moins huit jours de calendrier.
 */
function cameBack(days: string[]): boolean {
  return days.some((day, i) => i > 0 && shiftDay(days[i - 1], 8) <= day);
}

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
  // Ajoutés le 07/10/2026 : des trophées qui regardent un objectif, les
  // notes, ou le retour après une pause — plus seulement des totaux.
  {
    id: 'touche-a-tout',
    icon: '🧭',
    name: 'Touche-à-tout',
    desc: 'Travailler 3 objectifs différents le même jour.',
    family: 'base',
    test: (c) => sameDayGoals(c.checkins, 3),
  },
  {
    id: 'carnet',
    icon: '📝',
    name: 'Carnet de bord',
    desc: 'Écrire 10 notes sur tes check-ins.',
    family: 'base',
    test: (c) => c.checkins.filter((k) => (k.note ?? '').trim() !== '').length >= 10,
  },
  {
    // L'antidote à l'effet « et puis merde » (docs/etude-quotidien.md) :
    // revenir compte autant que ne jamais partir.
    id: 'retour',
    icon: '🔄',
    name: 'Le retour',
    desc: 'Reprendre après au moins 7 jours sans rien.',
    family: 'base',
    test: (c) => cameBack(activityDays(c.goals, c.checkins)),
  },
  {
    id: 'premier-or',
    icon: '🥇',
    name: 'Premier or',
    desc: 'Valider un palier de rang Or ou plus.',
    family: 'base',
    test: (c) => c.goals.some((g) => g.tiers.some((t) => t.completedAt && getRank(t.rank).value >= 4)),
  },
  {
    id: 'ascension',
    icon: '⛰️',
    name: 'Ascension',
    desc: 'Valider 10 paliers.',
    family: 'base',
    test: (c) => c.completedTiers >= 10,
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
  {
    id: 'fidele',
    icon: '🌱',
    name: 'Fidèle',
    desc: "30 jours d'affilée sur un même objectif.",
    family: 'rare',
    test: (c) => c.goals.some((g) => bestGoalStreak(g, c.checkins) >= 30),
  },
  {
    id: 'centurion',
    icon: '💯',
    name: 'Centurion',
    desc: "100 jours d'activité sur un même objectif.",
    family: 'rare',
    test: (c) => c.goals.some((g) => goalDays(g, c.checkins) >= 100),
  },
  {
    id: 'une-annee',
    icon: '🌞',
    name: 'Une année',
    desc: "365 jours d'activité d'affilée.",
    family: 'rare',
    test: (c) => c.bestStreak >= 365,
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
