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

/** Décale un jour de `offset` jours (peut être négatif). */
function shiftDay(day: string, offset: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return dayString(new Date(y, m - 1, d + offset, 12));
}

export type DayStreakStatus = 'done' | 'frozen' | 'missed' | 'pending';

export interface DayStreakEntry {
  day: string;
  status: DayStreakStatus;
}

interface StreakWalk {
  result: Streak;
  /** Jour par jour, du premier jour d'activité à aujourd'hui inclus. */
  history: DayStreakEntry[];
}

/**
 * Le calcul du streak, rejoué jour par jour. `computeStreak` n'en garde que
 * le résultat final ; `recentStreakDays` en garde le détail — la même
 * marche, jamais deux logiques qui pourraient diverger.
 */
function walkStreak(
  goals: Goal[],
  checkins: Checkin[],
  today: string,
  purchases: FreezePurchase[],
): StreakWalk {
  const days = activityDays(goals, checkins).filter((d) => d <= today);
  const history: DayStreakEntry[] = [];
  if (days.length === 0) {
    return {
      result: { current: 0, best: 0, freezes: 0, activeToday: false, atRisk: false },
      history,
    };
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

  /** Marque, du même statut, chaque jour strictement entre `from` et `to`. */
  function markGap(from: string, to: string, status: DayStreakStatus) {
    let cursor = from;
    for (;;) {
      cursor = shiftDay(cursor, 1);
      if (cursor >= to) return;
      history.push({ day: cursor, status });
    }
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
          markGap(previous, day, 'frozen');
          consommer(gap); // les gels absorbent les jours manqués
        } else {
          markGap(previous, day, 'missed'); // trou trop grand : le streak repart
          current = 0;
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
    history.push({ day, status: 'done' });
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
    // n'est pas finie — aujourd'hui reste « en attente », ni flamme ni gel.
    // Il est « à risque » si les jours manqués depuis la dernière action
    // (aujourd'hui exclu) restent absorbables par les gels.
    const missed = sinceLast - 1; // jours pleins manqués avant aujourd'hui
    if (missed > freezes) {
      // Série perdue : la réserve l'accompagne, comme au-dessus.
      markGap(last, today, 'missed');
      history.push({ day: today, status: 'pending' });
      return {
        result: { current: 0, best, freezes: 0, activeToday: false, atRisk: false },
        history,
      };
    }
    // Les gels qui couvriront ces jours manqués sont déjà engagés : les
    // annoncer comme disponibles trompe l'utilisateur au seul moment où il
    // consulte ce chiffre — celui où il se demande s'il peut sauter un jour
    // de plus. La réserve annoncée est donc celle qui restera.
    markGap(last, today, 'frozen');
    history.push({ day: today, status: 'pending' });
    return {
      result: { current, best, freezes: freezes - missed, activeToday: false, atRisk: true },
      history,
    };
  }

  return { result: { current, best, freezes, activeToday: true, atRisk: false }, history };
}

export function computeStreak(
  goals: Goal[],
  checkins: Checkin[],
  today: string = dayString(),
  purchases: FreezePurchase[] = [],
): Streak {
  return walkStreak(goals, checkins, today, purchases).result;
}

/**
 * Le détail jour par jour du streak, pour une bandelette visuelle sur
 * l'accueil : une flamme allumée les jours faits, un gel les jours couverts
 * par un gel, une flamme éteinte les jours vraiment manqués. `count` jours,
 * aujourd'hui inclus, le plus ancien en premier.
 *
 * Un jour antérieur au tout premier jour d'activité (rien à raconter avant
 * que le streak existe) est rendu `'pending'`, neutre — pas `'missed'`, qui
 * laisserait croire à un jour manqué plutôt qu'à une app pas encore utilisée.
 */
export function recentStreakDays(
  goals: Goal[],
  checkins: Checkin[],
  purchases: FreezePurchase[] = [],
  today: string = dayString(),
  count = 7,
): DayStreakEntry[] {
  const { history } = walkStreak(goals, checkins, today, purchases);
  const byDay = new Map(history.map((h) => [h.day, h.status]));
  const out: DayStreakEntry[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const day = shiftDay(today, -i);
    out.push({ day, status: byDay.get(day) ?? 'pending' });
  }
  return out;
}
