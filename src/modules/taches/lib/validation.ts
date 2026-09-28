/**
 * Validation d'une tâche — bibliothèque pure. Les règles de la base
 * (migration du 27/09/2026) dites en français, plus celles que la base ne
 * peut pas vérifier seule : les sous-tâches sur un seul niveau.
 */
import { validateRecurrence } from '../../../core/lib/recurrence';
import { DURATION_MAX, DURATION_MIN, TASK_TITLE_MAX, type Task, type TaskInput } from './types';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Rend le message de la première règle enfreinte, ou `null`. `tasks` : les
 * tâches existantes, pour vérifier le niveau des sous-tâches ; `selfId` : la
 * tâche modifiée, s'il y en a une.
 */
export function validateTask(input: TaskInput, tasks: readonly Task[] = [], selfId?: string): string | null {
  const title = input.title.trim();
  if (!title) return 'Donne un titre à la tâche.';
  if (title.length > TASK_TITLE_MAX) return `Le titre est trop long (${TASK_TITLE_MAX} caractères au plus).`;
  if (input.plannedDay && !DAY.test(input.plannedDay)) return 'Jour prévu invalide.';
  if (input.dueDay && !DAY.test(input.dueDay)) return 'Échéance invalide.';
  if (input.plannedTime) {
    if (!input.plannedDay) return 'Une heure a besoin d’un jour.';
    if (!TIME.test(input.plannedTime)) return 'Heure invalide.';
  }
  if (input.durationMinutes !== undefined && input.durationMinutes !== null) {
    if (!input.plannedTime) return 'Une durée a besoin d’une heure.';
    if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < DURATION_MIN || input.durationMinutes > DURATION_MAX) {
      return 'La durée doit aller de 5 minutes à 24 heures.';
    }
  }
  if (input.recurrence) {
    if (!input.plannedDay) return 'Une tâche répétée a besoin d’un jour prévu.';
    if (input.parentId) return 'Une sous-tâche ne se répète pas : c’est sa tâche qui se répète.';
    const problem = validateRecurrence(input.recurrence, input.plannedDay);
    if (problem) return problem;
  }
  if (input.parentId) {
    if (input.parentId === selfId) return 'Une tâche ne peut pas être sa propre sous-tâche.';
    const parent = tasks.find((t) => t.id === input.parentId);
    if (!parent) return 'La tâche parente n’existe plus.';
    if (parent.parentId) return 'Une sous-tâche ne peut pas avoir de sous-tâches : un seul niveau.';
    if (selfId && tasks.some((t) => t.parentId === selfId)) return 'Une tâche qui a des sous-tâches ne peut pas devenir une sous-tâche.';
  }
  return null;
}
