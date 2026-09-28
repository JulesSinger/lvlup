/**
 * Ce que montre chaque vue de Polaris — bibliothèque pure (étape 2,
 * docs/etude-taches.md §4). Les vues ne portent que sur les tâches de
 * premier niveau : une sous-tâche s'affiche sous sa tâche, jamais seule.
 */
import { daysBetween, shiftDay } from '../../../core/lib/day';
import type { Priority, Task } from './types';

/** Une échéance entre dans « Aujourd'hui » ce nombre de jours avant (elle est « proche »). */
export const DUE_SOON_DAYS = 2;
/** L'horizon de « À venir ». */
export const UPCOMING_DAYS = 14;

const RANK: Record<Priority, number> = { urgente: 0, importante: 1, normale: 2 };

const open = (t: Task) => !t.completedAt && !t.parentId;

/**
 * L'ordre d'une journée : ce qui a une heure d'abord, dans l'ordre des
 * heures ; puis par priorité, par échéance la plus proche, et enfin dans
 * l'ordre choisi à la main.
 */
export function compareTasks(a: Task, b: Task): number {
  if (a.plannedTime && b.plannedTime && a.plannedTime !== b.plannedTime) return a.plannedTime.localeCompare(b.plannedTime);
  if (!!a.plannedTime !== !!b.plannedTime) return a.plannedTime ? -1 : 1;
  if (RANK[a.priority] !== RANK[b.priority]) return RANK[a.priority] - RANK[b.priority];
  if (a.dueDay !== b.dueDay) {
    if (!a.dueDay) return 1;
    if (!b.dueDay) return -1;
    return a.dueDay.localeCompare(b.dueDay);
  }
  return a.position - b.position || a.createdAt.localeCompare(b.createdAt);
}

/** Où en est l'échéance d'une tâche : dépassée, aujourd'hui, proche, ou rien à signaler. */
export function dueStatus(task: Pick<Task, 'dueDay'>, today: string): 'overdue' | 'today' | 'soon' | null {
  if (!task.dueDay) return null;
  const left = daysBetween(today, task.dueDay);
  if (left < 0) return 'overdue';
  if (left === 0) return 'today';
  return left <= DUE_SOON_DAYS ? 'soon' : null;
}

/**
 * « Aujourd'hui » : les tâches en retard (jour prévu passé, ou échéance
 * dépassée), puis celles du jour (prévues aujourd'hui, ou dont l'échéance
 * approche). Chaque tâche n'apparaît qu'une fois.
 */
export function todayView(tasks: readonly Task[], today: string): { overdue: Task[]; today: Task[] } {
  const overdue: Task[] = [];
  const current: Task[] = [];
  for (const t of tasks) {
    if (!open(t)) continue;
    const due = dueStatus(t, today);
    if ((t.plannedDay && t.plannedDay < today) || due === 'overdue') overdue.push(t);
    else if (t.plannedDay === today || due === 'today' || due === 'soon') current.push(t);
  }
  return { overdue: overdue.sort(compareTasks), today: current.sort(compareTasks) };
}

/**
 * « À venir » : les 14 jours après aujourd'hui, jour par jour — y compris
 * les jours vides, pour voir la semaine telle qu'elle est. Une tâche sans
 * jour prévu mais avec une échéance y figure au jour de son échéance.
 */
export function upcomingView(tasks: readonly Task[], today: string, days = UPCOMING_DAYS): { day: string; tasks: Task[] }[] {
  const byDay = new Map<string, Task[]>();
  for (let i = 1; i <= days; i++) byDay.set(shiftDay(today, i), []);
  for (const t of tasks) {
    if (!open(t)) continue;
    const day = t.plannedDay ?? t.dueDay;
    byDay.get(day ?? '')?.push(t);
  }
  return [...byDay.entries()].map(([day, list]) => ({ day, tasks: list.sort(compareTasks) }));
}

/** La boîte de réception : ce qui n'a pas encore de liste. */
export function inboxView(tasks: readonly Task[]): Task[] {
  return tasks.filter((t) => open(t) && t.listId === null).sort(compareTasks);
}

/** Une liste : ses tâches à faire, dans l'ordre choisi à la main. */
export function listView(tasks: readonly Task[], listId: string): Task[] {
  return tasks
    .filter((t) => open(t) && t.listId === listId)
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}

/** « Terminées » : ce qui a été fait, le plus récent d'abord, regroupé par jour local. */
export function doneView(tasks: readonly Task[], dayOf: (iso: string) => string): { day: string; tasks: Task[] }[] {
  const groups = new Map<string, Task[]>();
  const done = tasks.filter((t) => t.completedAt && !t.parentId).sort((a, b) => (b.completedAt as string).localeCompare(a.completedAt as string));
  for (const t of done) {
    const day = dayOf(t.completedAt as string);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(t);
  }
  return [...groups.entries()].map(([day, list]) => ({ day, tasks: list }));
}

/** Les sous-tâches d'une tâche, dans l'ordre choisi. */
export function subtasksOf(tasks: readonly Task[], parentId: string): Task[] {
  return tasks
    .filter((t) => t.parentId === parentId)
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}
