/**
 * « Faire le point » — bibliothèque pure (étape 4, décision du 27/09/2026) :
 * trier d'un geste chaque tâche en retard. Le bandeau n'apparaît que s'il y
 * en a, et disparaît une fois tout trié.
 *
 * Une tâche est en retard pour l'une de deux raisons, et le geste agit sur
 * la date qui l'a mise en retard :
 *  · son **jour prévu** est passé → on la reprévoit (ou on retire le jour) ;
 *  · son **échéance** est dépassée → on repousse l'échéance (ou on la retire),
 *    jamais en silence : c'est l'utilisateur qui le choisit.
 *
 * Une tâche répétée en retard ne se déplace pas (ce qui changerait son jour
 * de la semaine ou du mois) : on passe à sa prochaine occurrence, ou on la
 * coche.
 */
import { shiftDay } from '../../../core/lib/day';
import { nextOccurrence } from './repeat';
import type { Task, TaskPatch } from './types';

/** La prochaine occurrence à partir d'aujourd'hui **inclus** : « tous les lundis » en retard, un lundi, revient aujourd'hui. */
const upcoming = (task: Task, today: string) => nextOccurrence(task, shiftDay(today, -1));

export type LateReason = 'planned' | 'due';

export function lateReason(task: Pick<Task, 'plannedDay' | 'dueDay'>, today: string): LateReason | null {
  if (task.plannedDay && task.plannedDay < today) return 'planned';
  if (task.dueDay && task.dueDay < today) return 'due';
  return null;
}

export type TriageAction = { kind: 'today' } | { kind: 'tomorrow' } | { kind: 'day'; day: string } | { kind: 'none' } | { kind: 'skip' };

/** Les gestes proposés pour une tâche en retard. */
export function triageActions(task: Task, today: string): TriageAction['kind'][] {
  const reason = lateReason(task, today);
  if (!reason) return [];
  if (task.recurrence && reason === 'planned') return upcoming(task, today) ? ['skip'] : [];
  return ['today', 'tomorrow', 'day', 'none'];
}

/** Ce qu'il faut écrire pour un geste. `null` si le geste n'a pas de sens pour cette tâche. */
export function triagePatch(task: Task, action: TriageAction, today: string): TaskPatch | null {
  const reason = lateReason(task, today);
  if (!reason || !triageActions(task, today).includes(action.kind)) return null;
  if (action.kind === 'skip') {
    const next = upcoming(task, today);
    return next ? { plannedDay: next.plannedDay, recurrence: next.recurrence } : null;
  }
  const day = action.kind === 'today' ? today : action.kind === 'tomorrow' ? shiftDay(today, 1) : action.kind === 'day' ? action.day : null;
  if (reason === 'planned') return day ? { plannedDay: day } : { plannedDay: null, plannedTime: null };
  return { dueDay: day };
}
