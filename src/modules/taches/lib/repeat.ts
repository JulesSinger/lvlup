/**
 * Cocher une tâche — bibliothèque pure (étape 2, docs/etude-taches.md §3).
 *
 * Une tâche répétée n'a **qu'une occurrence à la fois**. La cocher garde une
 * copie terminée (pour la vue Terminées) et fait avancer la tâche à sa date
 * suivante :
 *  · `schedule` (« tous les lundis ») : le prochain jour de la règle **après
 *    aujourd'hui** — une tâche oubliée trois lundis ne laisse pas trois
 *    retards derrière elle, elle repart au lundi qui vient ;
 *  · `completion` (« 10 jours après ») : N jours, semaines, mois ou ans après
 *    le jour où on l'a faite, quel que soit le jour prévu.
 *
 * La règle elle-même est le moteur commun du socle (`core/lib/recurrence.ts`).
 */
import { daysBetween, maxDay, shiftDay } from '../../../core/lib/day';
import { ruleDays } from '../../../core/lib/recurrence';
import type { Recurrence, Task, TaskInput, TaskPatch } from './types';

/** Assez loin pour trouver la suivante de toute règle : un 29 février revient au plus tard en 8 ans. */
const SEARCH_DAYS = 366 * 9;

/** `day` + `n` mois, ramené au dernier jour du mois s'il n'existe pas (31 janvier + 1 mois = 28 février). */
function addMonths(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** La prochaine occurrence d'une tâche répétée cochée le jour `doneDay`, ou `null` si la série est finie. */
export function nextOccurrence(
  task: Pick<Task, 'plannedDay' | 'recurrence' | 'repeatFrom'>,
  doneDay: string,
): { plannedDay: string; recurrence: Recurrence } | null {
  const rule = task.recurrence;
  if (!rule || !task.plannedDay) return null;
  const interval = Math.max(1, rule.interval || 1);

  if (task.repeatFrom === 'completion') {
    const next =
      rule.freq === 'daily'
        ? shiftDay(doneDay, interval)
        : rule.freq === 'weekly'
          ? shiftDay(doneDay, 7 * interval)
          : addMonths(doneDay, rule.freq === 'monthly' ? interval : 12 * interval);
    if (rule.until && next > rule.until) return null;
    if (rule.count !== undefined) {
      if (rule.count <= 1) return null;
      return { plannedDay: next, recurrence: { ...rule, count: rule.count - 1 } };
    }
    return { plannedDay: next, recurrence: rule };
  }

  // `schedule` : la série part du jour prévu ; `count` y compte l'occurrence en cours.
  const series = { startDay: task.plannedDay, recurrence: rule };
  const after = maxDay(task.plannedDay, doneDay);
  const [next] = ruleDays(series, shiftDay(after, 1), shiftDay(after, SEARCH_DAYS));
  if (!next) return null;
  if (rule.count !== undefined) {
    // Les occurrences sautées (oubliées) sont consommées, comme dans un agenda.
    const used = ruleDays(series, task.plannedDay, shiftDay(next, -1)).length;
    return { plannedDay: next, recurrence: { ...rule, count: rule.count - used } };
  }
  return { plannedDay: next, recurrence: rule };
}

/** Les écritures qui cochent une tâche, dans l'ordre : créer, puis modifier. */
export interface CompletionPlan {
  /** La copie terminée d'une tâche répétée, avec l'identifiant choisi par l'appelant */
  create?: { id: string; input: TaskInput };
  updates: { id: string; patch: TaskPatch }[];
}

/**
 * Cocher `task` à l'instant `now` (jour local `doneDay`).
 *
 * Tâche simple : elle est notée faite. Tâche répétée : une copie terminée
 * garde la trace, et la tâche avance — jour prévu, échéance décalée d'autant,
 * sous-tâches décochées pour la prochaine fois. Série finie : la tâche est
 * simplement notée faite.
 */
export function completionPlan(task: Task, subtasks: readonly Task[], now: string, doneDay: string, copyId: string): CompletionPlan {
  const next = nextOccurrence(task, doneDay);
  if (!next) return { updates: [{ id: task.id, patch: { completedAt: now } }] };

  const { id: _id, completedAt: _done, createdAt: _created, ...fields } = task;
  const shift = daysBetween(task.plannedDay as string, next.plannedDay);
  return {
    create: { id: copyId, input: { ...fields, recurrence: null } },
    updates: [
      { id: copyId, patch: { completedAt: now } },
      {
        id: task.id,
        patch: {
          plannedDay: next.plannedDay,
          dueDay: task.dueDay ? shiftDay(task.dueDay, shift) : null,
          recurrence: next.recurrence,
        },
      },
      ...subtasks.filter((s) => s.completedAt).map((s) => ({ id: s.id, patch: { completedAt: null } })),
    ],
  };
}

/** Ce qu'il faut écrire pour défaire une coche : retirer la copie, remettre la tâche comme avant. */
export interface UndoPlan {
  deleteId?: string;
  updates: { id: string; patch: TaskPatch }[];
}

/**
 * Défaire `plan` appliqué à `task` (telle qu'elle était avant) et à ses
 * sous-tâches : la copie terminée disparaît, la tâche retrouve son jour, son
 * échéance et sa règle, les sous-tâches décochées sont recochées.
 */
export function undoCompletion(task: Task, subtasks: readonly Task[], plan: CompletionPlan): UndoPlan {
  if (!plan.create) return { updates: [{ id: task.id, patch: { completedAt: task.completedAt } }] };
  return {
    deleteId: plan.create.id,
    updates: [
      { id: task.id, patch: { plannedDay: task.plannedDay, dueDay: task.dueDay, recurrence: task.recurrence } },
      ...subtasks.filter((s) => s.completedAt).map((s) => ({ id: s.id, patch: { completedAt: s.completedAt } })),
    ],
  };
}

/** Garde-fou : un aperçu ne déplie pas plus d'occurrences que ça. */
const MAX_FORECAST = 400;

/**
 * L'aperçu des occurrences **suivantes** d'une tâche répétée entre `from` et
 * `to` (demande de Jules, 28/09/2026) : les jours où elle reviendra après
 * l'occurrence en cours, pour les voir dans « À venir » et dans Éclipse. Rien
 * n'est stocké ni cochable : une tâche n'a toujours qu'une occurrence à la
 * fois, celle-ci n'est qu'un calcul depuis sa règle.
 *
 * Même règle que `nextOccurrence` : à date fixe, les jours de la règle
 * **après aujourd'hui** (une tâche en retard ne fait pas réapparaître les
 * semaines manquées) ; après l'avoir faite, en supposant qu'elle le sera au
 * jour prévu — seule hypothèse possible, l'écran le dit.
 */
export function upcomingOccurrences(task: Task, today: string, from: string, to: string): string[] {
  if (!task.recurrence || !task.plannedDay || task.completedAt || task.parentId) return [];
  const days: string[] = [];
  let current: Pick<Task, 'plannedDay' | 'recurrence' | 'repeatFrom'> = task;
  let done = maxDay(task.plannedDay, today);
  for (let i = 0; i < MAX_FORECAST; i++) {
    const next = nextOccurrence(current, done);
    if (!next || next.plannedDay > to) break;
    if (next.plannedDay >= from) days.push(next.plannedDay);
    current = { ...current, plannedDay: next.plannedDay, recurrence: next.recurrence };
    done = next.plannedDay;
  }
  return days;
}
