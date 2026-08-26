import type { Checkin, FreezePurchase, Goal } from './types';

/**
 * Streak : jours consécutifs avec au moins une action (check-in ou palier
 * validé). Entièrement recalculé depuis l'historique — aucun état stocké,
 * donc aucun risque de désynchronisation entre appareils.
 *
 * Les gels (règle « pardon avant punition », leçon du benchmark) :
 * - chaque tranche de 7 jours consécutifs rapporte 1 gel, stockables jusqu'à 3 ;
 * - un jour manqué consomme 1 gel au lieu de casser le streak ;
 * - un gel peut aussi s'acheter avec les PP de la semaine ; acheté ou gagné,
 *   il est le même objet, et il n'est disponible qu'à partir de son jour
 *   d'achat — un gel acheté mardi ne protège pas le lundi d'avant ;
 * - un trou plus grand que la réserve de gels remet le streak à zéro, **et la
 *   réserve avec lui** : un gel récompense une régularité installée, il n'a pas
 *   à protéger un redémarrage ;
 * - la réserve annoncée est toujours celle qui **restera** une fois les jours
 *   déjà manqués couverts, jamais celle d'avant leur prise en compte.
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
  purchases: FreezePurchase[] = [],
): Streak {
  const days = activityDays(goals, checkins).filter((d) => d <= today);
  if (days.length === 0) {
    return { current: 0, best: 0, freezes: 0, activeToday: false, atRisk: false };
  }

  let current = 0;
  let best = 0;
  /**
   * La réserve est tenue en deux poches. L'utilisateur n'en voit qu'un nombre
   * — un gel acheté vaut un gel gagné — mais elles ne se comportent pas
   * pareil à la rupture : une série cassée efface ce qui avait été *gagné*
   * par cette série, jamais ce qui a été *payé*. Confisquer 200 PP parce
   * qu'on a manqué trois jours serait une punition déguisée, et ce projet
   * n'en veut aucune.
   */
  let gagnes = 0;
  let achetes = 0;
  let freezeCredits = 0; // tranches de 7 jours déjà créditées sur le streak en cours
  let previous: string | null = null;

  // Les achats, du plus ancien au plus récent : crédités au fil du temps, pour
  // qu'un gel acheté ne couvre jamais un trou antérieur à son achat.
  const achats = purchases
    .filter((p) => p.day <= today)
    .map((p) => p.day)
    .sort();
  let achatsCredites = 0;

  /** Ce que l'utilisateur voit : une seule réserve, plafonnée. */
  const reserve = () => Math.min(MAX_FREEZES, gagnes + achetes);

  /** Consomme `n` gels, les gagnés d'abord — on garde le payé pour la fin. */
  function consommer(n: number) {
    const surGagnes = Math.min(gagnes, n);
    gagnes -= surGagnes;
    achetes = Math.max(0, achetes - (n - surGagnes));
  }

  for (const day of days) {
    // Tout ce qui a été acheté jusqu'à ce jour inclus est disponible.
    while (achatsCredites < achats.length && achats[achatsCredites] <= day) {
      achetes += 1;
      achatsCredites += 1;
    }
    if (previous !== null) {
      const gap = daysBetween(previous, day) - 1;
      if (gap > 0) {
        if (gap <= reserve()) {
          consommer(gap); // les gels absorbent les jours manqués
        } else {
          current = 0; // trou trop grand : le streak repart
          freezeCredits = 0;
          // La réserve gagnée repart avec lui : un gel gagné récompense une
          // régularité installée, le garder après une rupture amortirait en
          // silence les premiers trous d'une habitude toute neuve. Ce qui a
          // été acheté, en revanche, reste acquis.
          gagnes = 0;
          consommer(0);
        }
      }
    }
    current += 1;
    if (current > best) best = current;
    // Un gel gagné à 7, 14, 21… jours consécutifs, plafonné à la réserve max.
    const earned = Math.floor(current / FREEZE_EVERY_DAYS);
    if (earned > freezeCredits) {
      gagnes = Math.min(MAX_FREEZES, gagnes + (earned - freezeCredits));
      freezeCredits = earned;
    }
    previous = day;
  }

  const freezes = reserve();

  const last = days[days.length - 1];
  const sinceLast = daysBetween(last, today);
  const activeToday = sinceLast === 0;

  if (!activeToday) {
    // Rien fait aujourd'hui : le streak n'est PAS cassé tant que la journée
    // n'est pas finie. Il est « à risque » si les jours manqués depuis la
    // dernière action (aujourd'hui exclu) restent absorbables par les gels.
    const missed = sinceLast - 1; // jours pleins manqués avant aujourd'hui
    if (missed > freezes) {
      // Série perdue : la réserve l'accompagne, comme au-dessus.
      return { current: 0, best, freezes: 0, activeToday: false, atRisk: false };
    }
    // Les gels qui couvriront ces jours manqués sont déjà engagés : les
    // annoncer comme disponibles trompe l'utilisateur au seul moment où il
    // consulte ce chiffre — celui où il se demande s'il peut sauter un jour
    // de plus. La réserve annoncée est donc celle qui restera.
    return { current, best, freezes: freezes - missed, activeToday: false, atRisk: true };
  }

  return { current, best, freezes, activeToday: true, atRisk: false };
}
