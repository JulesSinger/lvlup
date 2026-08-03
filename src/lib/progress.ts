import { getRank, rankByValue, type Rank } from './ranks';
import { dayString } from './streak';
import type { Checkin, Goal, Tier } from './types';

export interface GoalProgress {
  done: number;
  total: number;
  /** Pourcentage de paliers validés, 0 quand l'objectif n'a aucun palier */
  percent: number;
  /** Rang actuel = rang du dernier palier validé, null si aucun */
  rank: Rank | null;
  /** Prochain palier à viser, null si l'objectif est terminé */
  next: Tier | null;
  complete: boolean;
}

export function goalProgress(goal: Goal): GoalProgress {
  const tiers = goal.tiers.slice().sort((a, b) => a.position - b.position);
  const completed = tiers.filter((t) => t.completedAt);
  const total = tiers.length;
  const done = completed.length;

  // Le rang affiché est celui du palier validé le plus élevé, pas du dernier
  // validé chronologiquement : valider un palier ne peut jamais faire baisser
  // le rang affiché.
  const best = completed.reduce<Tier | null>((acc, tier) => {
    if (!acc) return tier;
    return getRank(tier.rank).value > getRank(acc.rank).value ? tier : acc;
  }, null);

  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    rank: best ? getRank(best.rank) : null,
    next: tiers.find((t) => !t.completedAt) ?? null,
    complete: total > 0 && done === total,
  };
}

export interface ProfileRank {
  rank: Rank | null;
  /** Moyenne brute des rangs, sert à afficher la progression vers le rang suivant */
  average: number;
  /** Part du chemin parcouru vers le rang supérieur, entre 0 et 1 */
  toNext: number;
  rankedGoals: number;
}

/**
 * Rang global du profil : moyenne des rangs actuels de tous les objectifs
 * actifs qui ont au moins un palier. Un objectif commencé mais sans palier
 * validé compte comme 0 et tire la moyenne vers le bas — c'est voulu, sinon
 * créer des objectifs sans les travailler gonflerait le rang.
 */
export function profileRank(goals: Goal[]): ProfileRank {
  const active = goals.filter((g) => !g.archived && g.tiers.length > 0);
  if (active.length === 0) return { rank: null, average: 0, toNext: 0, rankedGoals: 0 };

  const total = active.reduce((sum, goal) => {
    const { rank } = goalProgress(goal);
    return sum + (rank ? rank.value : 0);
  }, 0);

  const average = total / active.length;
  if (average < 1) return { rank: null, average, toNext: average, rankedGoals: active.length };

  const rank = rankByValue(Math.floor(average));
  return {
    rank,
    average,
    toNext: Math.min(1, average - Math.floor(average)),
    rankedGoals: active.length,
  };
}

/**
 * Points de Palier (PP) rapportés par la validation d'un palier d'un rang donné.
 * Barème simple et lisible : 25 PP par échelon de rang (Fer = 25 … Challenger = 250).
 */
export function ppForRank(rank: Rank): number {
  return rank.value * 25;
}

/** PP d'un check-in d'avant les actions (repli pour les données anciennes). */
export const CHECKIN_PP = 10;

/** Somme des PP d'une liste de réalisations. */
export function sumCheckinPP(checkins: Checkin[]): number {
  return checkins.reduce((sum, c) => sum + (c.pp ?? CHECKIN_PP), 0);
}

/**
 * Total des PP du profil : paliers validés + check-ins quotidiens. C'est le
 * score cumulatif de toute la progression — il ne redescend jamais tant qu'on
 * n'annule pas une validation ou un check-in.
 */
export function profilePP(goals: Goal[], checkins: Checkin[] = []): number {
  const tiersPP = goals
    .filter((g) => !g.archived)
    .reduce(
      (sum, goal) =>
        sum +
        goal.tiers.reduce(
          (acc, tier) => acc + (tier.completedAt ? ppForRank(getRank(tier.rank)) : 0),
          0,
        ),
      0,
    );
  return tiersPP + sumCheckinPP(checkins);
}

/**
 * PP engrangés aujourd'hui : réalisations du jour + paliers validés aujourd'hui.
 * C'est ce que remplit l'anneau de l'objectif quotidien.
 */
export function todayPP(goals: Goal[], checkins: Checkin[], today: string = dayString()): number {
  const fromActions = sumCheckinPP(checkins.filter((c) => c.day === today));
  let fromTiers = 0;
  for (const goal of goals) {
    if (goal.archived) continue;
    for (const tier of goal.tiers) {
      if (tier.completedAt && dayString(new Date(tier.completedAt)) === today) {
        fromTiers += ppForRank(getRank(tier.rank));
      }
    }
  }
  return fromActions + fromTiers;
}

export interface PPPoint {
  /** Jour local YYYY-MM-DD */
  day: string;
  /** PP gagnés ce jour-là */
  gained: number;
  /** Total cumulé à la fin de ce jour */
  total: number;
  /** Paliers validés ce jour-là (pour marquer les jalons) */
  tiers: number;
}

/**
 * Courbe des PP cumulés : un point par jour ayant eu au moins une activité
 * (check-in ou palier validé), du plus ancien au plus récent.
 */
export function ppTimeline(goals: Goal[], checkins: Checkin[]): PPPoint[] {
  const perDay = new Map<string, { gained: number; tiers: number }>();
  const bump = (day: string, gained: number, tiers: number) => {
    const entry = perDay.get(day) ?? { gained: 0, tiers: 0 };
    entry.gained += gained;
    entry.tiers += tiers;
    perDay.set(day, entry);
  };

  for (const checkin of checkins) bump(checkin.day, checkin.pp ?? CHECKIN_PP, 0);
  for (const goal of goals) {
    if (goal.archived) continue;
    for (const tier of goal.tiers) {
      if (!tier.completedAt) continue;
      bump(dayString(new Date(tier.completedAt)), ppForRank(getRank(tier.rank)), 1);
    }
  }

  let running = 0;
  return [...perDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, { gained, tiers }]) => {
      running += gained;
      return { day, gained, total: running, tiers };
    });
}

export interface WeekStats {
  pp: number;
  checkins: number;
  tiersValidated: number;
}

/** Lundi de la semaine du jour donné (YYYY-MM-DD). */
function mondayOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  const shift = (date.getDay() + 6) % 7; // lundi = 0
  date.setDate(date.getDate() - shift);
  return dayString(date);
}

/**
 * Stats d'une semaine (lundi → dimanche) : PP gagnés, check-ins, paliers
 * validés. `offsetWeeks` = 0 pour la semaine en cours, -1 pour la précédente.
 */
export function weekStats(
  goals: Goal[],
  checkins: Checkin[],
  offsetWeeks = 0,
  today: string = dayString(),
): WeekStats {
  const [y, m, d] = mondayOf(today).split('-').map(Number);
  const start = new Date(y, m - 1, d + offsetWeeks * 7, 12);
  const startDay = dayString(start);
  const end = new Date(y, m - 1, d + offsetWeeks * 7 + 6, 12);
  const endDay = dayString(end);

  const weekCheckins = checkins.filter((c) => c.day >= startDay && c.day <= endDay);
  let tiersValidated = 0;
  let tiersPP = 0;
  for (const goal of goals) {
    if (goal.archived) continue;
    for (const tier of goal.tiers) {
      if (!tier.completedAt) continue;
      const day = dayString(new Date(tier.completedAt));
      if (day >= startDay && day <= endDay) {
        tiersValidated += 1;
        tiersPP += ppForRank(getRank(tier.rank));
      }
    }
  }
  return {
    pp: tiersPP + sumCheckinPP(weekCheckins),
    checkins: weekCheckins.length,
    tiersValidated,
  };
}

export interface HistoryEntry {
  tier: Tier;
  goal: Goal;
  date: Date;
}

/** Tous les paliers validés, du plus récent au plus ancien. */
export function history(goals: Goal[]): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  for (const goal of goals) {
    for (const tier of goal.tiers) {
      if (tier.completedAt) entries.push({ tier, goal, date: new Date(tier.completedAt) });
    }
  }
  return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return dateFormat.format(date);
}

export function relativeDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 30) return `il y a ${days} jours`;
  if (days < 365) return `il y a ${Math.round(days / 30)} mois`;
  return `il y a ${Math.round(days / 365)} an${days >= 730 ? 's' : ''}`;
}
