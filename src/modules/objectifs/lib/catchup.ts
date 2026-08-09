import { dayString } from './streak';
import type { Action, Checkin, Goal } from './types';

/**
 * Revenir sur les jours précédents.
 *
 * Deux besoins distincts vivent ici, et la première version n'en couvrait
 * qu'un :
 *
 *  · **Rattraper un oubli.** L'application confondait « je ne l'ai pas fait »
 *    et « je l'ai fait et j'ai oublié de le cocher ». Elle traitait les deux
 *    comme un échec, ce qui est faux une fois sur deux — et c'est le
 *    déclencheur d'abandon le mieux documenté des traqueurs d'habitudes.
 *    Pour celui-là, l'app pose la question d'elle-même.
 *
 *  · **Corriger.** Ajouter une action oubliée sur une journée déjà entamée,
 *    ou décocher quelque chose de coché par erreur. Là, l'app ne demande
 *    rien : elle laisse simplement la porte ouverte, repliée.
 *
 * La fenêtre reste courte. Sans limite, on remplirait un mois entier de bonne
 * foi et la courbe ne voudrait plus rien dire pour soi-même. Deux jours, c'est
 * l'intervalle où l'on se souvient honnêtement de ce qu'on a fait ; au-delà,
 * on ne se souvient plus, on reconstruit.
 */

/** Nombre de jours passés que l'on peut encore modifier. */
export const CATCHUP_DAYS = 2;

const KEY = 'zenith.catchup.ignores';

export interface CatchupDay {
  day: string;
  /** Actions cochées ce jour-là */
  done: number;
  /** Actions cochables au total */
  total: number;
  /**
   * true quand la journée est restée vide et que la question n'a pas déjà été
   * écartée : c'est le seul cas où l'app prend l'initiative de demander.
   */
  asks: boolean;
}

/** Jour local décalé de `offset` jours (−1 = hier). */
export function shiftDay(day: string, offset: number): string {
  const [y, m, d] = day.split('-').map(Number);
  // Midi local : neutralise les changements d'heure été/hiver.
  return dayString(new Date(y, m - 1, d + offset, 12));
}

function readIgnores(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/** « Non, rien fait ce jour-là » : on ne repose plus la question. */
export function ignoreDay(day: string, today: string = dayString()) {
  const limit = shiftDay(today, -(CATCHUP_DAYS + 5));
  const next = [...new Set([...readIgnores(), day])].filter((d) => d >= limit);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Stockage refusé : la question se reposera, ce n'est pas grave.
  }
}

export function isIgnored(day: string): boolean {
  return readIgnores().includes(day);
}

/**
 * Jours récents encore modifiables, du plus récent au plus ancien.
 *
 * Tous les jours de la fenêtre sont renvoyés, y compris ceux déjà bien
 * remplis : on doit pouvoir décocher une erreur d'hier, pas seulement ajouter
 * un oubli. C'est `asks` qui distingue la question spontanée du simple accès.
 *
 * On ne remonte jamais avant le premier objectif : inutile de demander à
 * quelqu'un s'il a oublié de cocher un jour où l'application n'existait pas
 * encore pour lui.
 */
export function catchupDays(
  goals: Goal[],
  actions: Action[],
  checkins: Checkin[],
  today: string = dayString(),
): CatchupDay[] {
  const active = goals.filter((g) => !g.archived);
  const activeIds = new Set(active.map((g) => g.id));
  const total = actions.filter((a) => activeIds.has(a.goalId)).length;
  if (total === 0) return [];

  const started = active.map((g) => dayString(new Date(g.createdAt))).sort()[0];

  const days: CatchupDay[] = [];
  for (let offset = 1; offset <= CATCHUP_DAYS; offset++) {
    const day = shiftDay(today, -offset);
    if (day < started) continue;
    const done = checkins.filter((c) => c.day === day).length;
    days.push({ day, done, total, asks: done === 0 && !isIgnored(day) });
  }
  return days;
}

const WEEKDAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric' });

/** « Hier · mercredi 5 », « Avant-hier · mardi 4 ». */
export function catchupLabel(day: string, today: string = dayString()): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d, 12);
  const offset = day === shiftDay(today, -1) ? 'Hier' : 'Avant-hier';
  return `${offset} · ${WEEKDAY.format(date)}`;
}

/** « rien de coché », « 1 action », « 3 actions ». */
export function catchupSummary(entry: CatchupDay): string {
  if (entry.done === 0) return 'rien de coché';
  return `${entry.done} action${entry.done > 1 ? 's' : ''}`;
}
