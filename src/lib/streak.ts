import type { Checkin, Goal } from './types';

/**
 * Streak : jours consécutifs avec au moins une action (check-in ou palier
 * validé). Entièrement recalculé depuis l'historique — aucun état stocké,
 * donc aucun risque de désynchronisation entre appareils.
 *
 * Les gels (règle « pardon avant punition », leçon du benchmark) :
 * - chaque tranche de 7 jours consécutifs rapporte 1 gel, stockables jusqu'à 3 ;
 * - un jour manqué consomme 1 gel au lieu de casser le streak ;
 * - un trou plus grand que la réserve de gels remet le streak à zéro.
 */

export interface Streak {
  /** Streak en cours (inclut aujourd'hui s'il est actif) */
  current: number;
  /** Meilleur streak jamais atteint */
  best: number;
  /** Gels en réserve */
  freezes: number;
  /** true si une action a déjà été faite aujourd'hui */
  activeToday: boolean;
  /**
   * true si le streak est encore sauvable : rien fait aujourd'hui, mais agir
   * avant minuit le prolonge (le cas échéant en consommant des gels).
   */
  atRisk: boolean;
}

export const MAX_FREEZES = 3;
const FREEZE_EVERY_DAYS = 7;

/** Jour local au format YYYY-MM-DD (le fuseau de l'appareil fait foi). */
export function dayString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  // Midi local pour neutraliser les changements d'heure été/hiver.
  const ta = new Date(ya, ma - 1, da, 12).getTime();
  const tb = new Date(yb, mb - 1, db, 12).getTime();
  return Math.round((tb - ta) / 86_400_000);
}

/** Tous les jours (YYYY-MM-DD) avec au moins une action, triés, sans doublon. */
export function activityDays(goals: Goal[], checkins: Checkin[]): string[] {
  const days = new Set<string>();
  for (const c of checkins) days.add(c.day);
  for (const goal of goals) {
    for (const tier of goal.tiers) {
      if (tier.completedAt) days.add(dayString(new Date(tier.completedAt)));
    }
  }
  return [...days].sort();
}

export function computeStreak(
  goals: Goal[],
  checkins: Checkin[],
  today: string = dayString(),
): Streak {
  const days = activityDays(goals, checkins).filter((d) => d <= today);
  if (days.length === 0) {
    return { current: 0, best: 0, freezes: 0, activeToday: false, atRisk: false };
  }

  let current = 0;
  let best = 0;
  let freezes = 0;
  let freezeCredits = 0; // tranches de 7 jours déjà créditées sur le streak en cours
  let previous: string | null = null;

  for (const day of days) {
    if (previous !== null) {
      const gap = daysBetween(previous, day) - 1;
      if (gap > 0) {
        if (gap <= freezes) {
          freezes -= gap; // les gels absorbent les jours manqués
        } else {
          current = 0; // trou trop grand : le streak repart
          freezeCredits = 0;
        }
      }
    }
    current += 1;
    if (current > best) best = current;
    // Un gel gagné à 7, 14, 21… jours consécutifs, plafonné à la réserve max.
    const earned = Math.floor(current / FREEZE_EVERY_DAYS);
    if (earned > freezeCredits) {
      freezes = Math.min(MAX_FREEZES, freezes + (earned - freezeCredits));
      freezeCredits = earned;
    }
    previous = day;
  }

  const last = days[days.length - 1];
  const sinceLast = daysBetween(last, today);
  const activeToday = sinceLast === 0;

  if (!activeToday) {
    // Rien fait aujourd'hui : le streak n'est PAS cassé tant que la journée
    // n'est pas finie. Il est « à risque » si les jours manqués depuis la
    // dernière action (aujourd'hui exclu) restent absorbables par les gels.
    const missed = sinceLast - 1; // jours pleins manqués avant aujourd'hui
    if (missed > freezes) {
      return { current: 0, best, freezes, activeToday: false, atRisk: false };
    }
    return { current, best, freezes, activeToday: false, atRisk: true };
  }

  return { current, best, freezes, activeToday: true, atRisk: false };
}
