import { shiftDay } from './catchup';
import { dayString } from './streak';
import type { Checkin, Goal } from './types';

/**
 * La mémoire d'une habitude.
 *
 * Zénith avait déjà tout d'un traqueur d'habitudes — une action est unique par
 * jour, chaque réalisation porte sa date, le streak compte les jours
 * consécutifs — sauf l'endroit où *voir* trois mois de régularité. Un compteur
 * « 47 / 90 » ne dit rien de la forme du parcours : deux trous isolés en juin
 * et dix jours d'affilée sautés en juillet s'y résument identiquement.
 *
 * Cette grille est cette mémoire, et rien d'autre. Aucun nouveau modèle de
 * données : elle se recalcule entièrement depuis les check-ins, comme le
 * streak et les compteurs de paliers.
 */

/** Fenêtre par défaut : le trimestre, l'horizon sur lequel une habitude se joue. */
export const HEATMAP_WEEKS = 12;

/**
 * Fenêtre longue : cinquante-trois colonnes couvrent une année entière quel
 * que soit le jour de la semaine où elle commence.
 */
export const HEATMAP_YEAR_WEEKS = 53;

/** Une case de la grille. */
export interface HeatCell {
  day: string;
  /** Hors de la fenêtre, ou avant la création de l'objectif : case fantôme. */
  inRange: boolean;
  /** PP gagnés sur cet objectif ce jour-là */
  pp: number;
  /** Nombre d'actions cochées ce jour-là */
  count: number;
  /** 0 = rien fait, 1 à 3 = intensité relative aux meilleurs jours */
  level: 0 | 1 | 2 | 3;
}

export interface Heatmap {
  /** Cases dans l'ordre du rendu : colonne par colonne, lundi → dimanche. */
  cells: HeatCell[];
  /** Nombre de semaines effectivement dessinées */
  columns: number;
  /** Étiquette de mois à poser au-dessus de certaines colonnes */
  months: { column: number; label: string }[];
  /** Jours actifs dans la fenêtre */
  active: number;
  /**
   * Hier est resté vide et aujourd'hui ne l'est pas encore.
   *
   * C'est la règle des deux jours, et le seul endroit où la grille prend la
   * parole : rater un jour est du bruit, en rater deux est un signal. On ne
   * la lève que pour une habitude vivante — sinon un objectif abandonné
   * depuis six mois passerait son temps à réclamer.
   */
  warnDay: string | null;
}

const MONTHS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

/** Lundi de la semaine d'un jour donné. */
export function mondayOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const weekday = (new Date(y, m - 1, d, 12).getDay() + 6) % 7; // 0 = lundi
  return shiftDay(day, -weekday);
}

/**
 * Grille d'un objectif.
 *
 * `weeks` colonnes de sept jours, la dernière contenant aujourd'hui. Rien n'est
 * dessiné avant la création de l'objectif : une grille vide affichée dès le
 * premier jour transforme un outil d'encouragement en bilan d'échec — la même
 * raison qui fait qu'un palier « jalon » n'affiche pas de barre à zéro.
 */
export function goalHeatmap(
  goal: Goal,
  checkins: Checkin[],
  options: { weeks?: number; today?: string; actionId?: string | null } = {},
): Heatmap {
  const weeks = options.weeks ?? HEATMAP_WEEKS;
  const today = options.today ?? dayString();
  const focus = options.actionId ?? null;
  const born = goal.createdAt.slice(0, 10);

  const start = mondayOf(shiftDay(today, -(weeks - 1) * 7));

  // PP et nombre d'actions par jour, pour ce seul objectif.
  const byDay = new Map<string, { pp: number; count: number }>();
  for (const c of checkins) {
    if (c.goalId !== goal.id) continue;
    // Filtrer sur une action répond à une autre question que la grille
    // entière : non plus « est-ce que je m'y suis mis », mais « laquelle de
    // mes trois actions je ne fais jamais ».
    if (focus !== null && c.actionId !== focus) continue;
    const entry = byDay.get(c.day) ?? { pp: 0, count: 0 };
    entry.pp += c.pp;
    entry.count += 1;
    byDay.set(c.day, entry);
  }

  // L'intensité est relative aux propres records de l'objectif, jamais à une
  // constante : une habitude binaire (une seule action) donne des jours tous
  // identiques — donc une couleur pleine et uniforme, ce qui est la vérité.
  let peak = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const day = shiftDay(start, i);
    if (day > today || day < born) continue;
    peak = Math.max(peak, byDay.get(day)?.pp ?? 0);
  }

  const cells: HeatCell[] = [];
  const months: { column: number; label: string }[] = [];
  let lastMonth = -1;
  let active = 0;

  for (let col = 0; col < weeks; col++) {
    const columnStart = shiftDay(start, col * 7);
    const month = Number(columnStart.slice(5, 7)) - 1;
    // L'étiquette se pose sur la colonne où le mois commence vraiment, sinon
    // « août » atterrit au-dessus de la dernière semaine de juillet.
    if (month !== lastMonth && Number(columnStart.slice(8, 10)) <= 7) {
      months.push({ column: col, label: MONTHS[month] });
      lastMonth = month;
    }
    for (let row = 0; row < 7; row++) {
      const day = shiftDay(columnStart, row);
      const inRange = day <= today && day >= born;
      const entry = inRange ? byDay.get(day) : undefined;
      const pp = entry?.pp ?? 0;
      if (pp > 0) active += 1;
      cells.push({
        day,
        inRange,
        pp,
        count: entry?.count ?? 0,
        level: pp === 0 ? 0 : peak === 0 ? 1 : pp >= peak * 0.75 ? 3 : pp >= peak * 0.4 ? 2 : 1,
      });
    }
  }

  return {
    cells,
    columns: weeks,
    months,
    active,
    warnDay: missedYesterday(goal, checkins, today, focus),
  };
}

/**
 * La règle des deux jours.
 *
 * Rien n'est signalé si l'objectif n'a pas vécu récemment : on ne réclame pas
 * pour quelque chose qu'on a arrêté il y a six mois, et on ne réclame pas non
 * plus le lendemain de la création. Rien n'est signalé non plus si aujourd'hui
 * est déjà fait — le danger est écarté.
 */
export function missedYesterday(
  goal: Goal,
  checkins: Checkin[],
  today: string = dayString(),
  actionId: string | null = null,
): string | null {
  if (goal.archived) return null;
  const yesterday = shiftDay(today, -1);
  const mine = checkins.filter(
    (c) => c.goalId === goal.id && (actionId === null || c.actionId === actionId),
  );
  if (mine.some((c) => c.day === today)) return null;
  if (mine.some((c) => c.day === yesterday)) return null;
  // Habitude vivante : au moins une réalisation dans les deux semaines, mais
  // pas seulement hier ou aujourd'hui (qu'on vient d'exclure).
  const floor = shiftDay(today, -14);
  const alive = mine.some((c) => c.day >= floor && c.day < yesterday);
  return alive ? yesterday : null;
}

/**
 * Jours consécutifs sur ce seul objectif.
 *
 * La flamme de Zénith est globale : elle compte les jours où on a fait
 * *quelque chose*, tous objectifs confondus. C'est le bon chiffre pour le
 * profil, et le mauvais pour une habitude — « je tiens depuis douze jours sur
 * celle-là » est précisément ce qu'on veut savoir, et c'est ce que le
 * compteur global ne peut pas dire.
 *
 * Pas de gels ici, volontairement : un gel protège le streak du profil, celui
 * qu'on perdrait vraiment. Les distribuer aussi par objectif reviendrait à en
 * donner autant que d'objectifs, et à vider le mécanisme de son sens.
 *
 * Même tolérance que le streak global en revanche : rien fait aujourd'hui ne
 * casse rien tant que la journée n'est pas finie.
 */
export function goalStreak(
  goal: Goal,
  checkins: Checkin[],
  today: string = dayString(),
  actionId: string | null = null,
): number {
  const days = new Set(
    checkins
      .filter(
        (c) =>
          c.goalId === goal.id &&
          c.day <= today &&
          (actionId === null || c.actionId === actionId),
      )
      .map((c) => c.day),
  );
  if (days.size === 0) return 0;

  let cursor = days.has(today) ? today : shiftDay(today, -1);
  let run = 0;
  while (days.has(cursor)) {
    run += 1;
    cursor = shiftDay(cursor, -1);
  }
  return run;
}

/**
 * L'état d'un objectif.
 *
 * « Accompli » convient à un marathon : on l'a couru, c'est fini. Il ne
 * convient pas à « arrêter de me ronger les ongles » au 365ᵉ jour — on n'a pas
 * fini, on **entretient**. La différence ne se déclare pas, elle s'observe :
 * un objectif dont tous les paliers sont tombés mais qu'on coche encore est en
 * entretien ; celui qu'on ne coche plus est accompli.
 */
export type GoalState = 'en-cours' | 'entretien' | 'accompli';

/** Fenêtre au-delà de laquelle un objectif terminé cesse d'être « entretenu ». */
export const MAINTENANCE_DAYS = 30;

export function goalState(
  goal: Goal,
  checkins: Checkin[],
  today: string = dayString(),
): GoalState {
  const tiers = goal.tiers;
  const complete = tiers.length > 0 && tiers.every((t) => t.completedAt);
  if (!complete) return 'en-cours';
  const floor = shiftDay(today, -MAINTENANCE_DAYS);
  const recent = checkins.some((c) => c.goalId === goal.id && c.day >= floor && c.day <= today);
  return recent ? 'entretien' : 'accompli';
}
