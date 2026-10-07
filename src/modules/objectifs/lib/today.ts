/**
 * La carte d'un objectif sur l'accueil — bibliothèque pure (07/10/2026).
 *
 * L'accueil montre désormais, pour chaque objectif, ce qu'on coche aujourd'hui
 * et le palier que ça fait monter, dans la même carte. Ces deux fonctions
 * disent ce que la carte ne peut pas deviner seule.
 */
import { shiftDay } from './catchup';
import { actionMeasureSeries, type Reading } from './quantities';
import type { Action, Checkin, Goal } from './types';

/**
 * Toutes les actions de l'objectif ont été cochées ce jour-là : la carte se
 * replie en « ✓ fait » et laisse la place à ce qui reste. Un objectif sans
 * action n'est jamais « fait » — il n'y a rien à cocher, pas rien à faire.
 */
export function dayComplete(goal: Goal, actions: Action[], checkins: Checkin[], day: string): boolean {
  const mine = actions.filter((a) => a.goalId === goal.id && !a.archived);
  if (mine.length === 0) return false;
  const done = new Set(checkins.filter((c) => c.goalId === goal.id && c.day === day).map((c) => c.actionId));
  return mine.every((a) => done.has(a.id));
}

/**
 * Le dernier relevé d'une action de mesure, avant le jour affiché : c'est le
 * chiffre qu'on a en tête en se pesant (« dernier 80,1 kg »). Celui du jour
 * même, s'il existe, est déjà sur la pastille.
 */
export function lastReading(action: Action, checkins: Checkin[], before: string): Reading | null {
  if (!action.isMeasure) return null;
  const series = actionMeasureSeries(action.id, checkins).filter((r) => r.day < before);
  return series.length > 0 ? series[series.length - 1] : null;
}

/**
 * La série de cet objectif s'est cassée hier : fait avant-hier, rien hier, rien
 * encore aujourd'hui. C'est le moment où « hier vide » sert à quelque chose.
 * La règle des deux jours de la grille (`missedYesterday`) se lève aussi pour
 * un objectif qu'on travaille une fois par semaine — une pesée — et sur
 * l'accueil, ce serait un reproche chaque semaine.
 */
export function brokeYesterday(goal: Goal, checkins: Checkin[], today: string): boolean {
  const days = new Set(checkins.filter((c) => c.goalId === goal.id).map((c) => c.day));
  return days.has(shiftDay(today, -2)) && !days.has(shiftDay(today, -1)) && !days.has(today);
}
