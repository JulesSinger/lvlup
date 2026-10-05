/**
 * Où en est le travail — bibliothèque pure (docs/etude-projets.md §4.5, §12).
 *
 * Rien ici n'est saisi : l'état d'un chantier et l'avancement d'un projet se
 * calculent depuis les tâches cochées. Un chiffre tapé à la main ment dès
 * qu'on oublie de le mettre à jour.
 */
import { daysBetween } from '../../../core/lib/day';
import type { Project, ProjectTask, Workstream } from './types';

/**
 * L'état d'un chantier :
 * - `waiting` : une de ses tâches restantes attend le client — prioritaire,
 *   c'est ce qui bloque ;
 * - `done` : tout est coché ;
 * - `doing` : une tâche est cochée, ou une tâche restante était prévue
 *   aujourd'hui ou avant (on a commencé, même sans rien finir) ;
 * - `todo` : rien de commencé ;
 * - `empty` : aucune tâche — il ne compte pas dans l'avancement.
 */
export type WorkstreamState = 'waiting' | 'doing' | 'todo' | 'done' | 'empty';

export const WORKSTREAM_STATE_LABELS: Record<WorkstreamState, string> = {
  waiting: 'Attend le client',
  doing: 'En cours',
  todo: 'À faire',
  done: 'Fait',
  empty: 'Sans tâche',
};

const isDone = (t: ProjectTask) => t.completedAt !== null;

export function workstreamState(tasks: readonly ProjectTask[], today: string): WorkstreamState {
  if (tasks.length === 0) return 'empty';
  const open = tasks.filter((t) => !isDone(t));
  if (open.length === 0) return 'done';
  if (open.some((t) => t.waitingClient)) return 'waiting';
  if (open.length < tasks.length) return 'doing';
  if (open.some((t) => t.plannedDay !== null && t.plannedDay <= today)) return 'doing';
  return 'todo';
}

export interface WorkstreamView {
  workstream: Workstream;
  tasks: ProjectTask[];
  state: WorkstreamState;
  done: number;
  total: number;
}

/** L'ordre des groupes dans la fiche : ce qui avance, ce qui bloque, ce qui attend, ce qui est fini. */
export const WORKSTREAM_STATE_ORDER: readonly WorkstreamState[] = ['doing', 'waiting', 'todo', 'empty', 'done'];

/**
 * Les chantiers d'un projet, avec leurs tâches (dans leur ordre) et leur
 * état, rangés par groupe d'état puis par position.
 */
export function projectWorkstreams(
  projectId: string,
  workstreams: readonly Workstream[],
  tasks: readonly ProjectTask[],
  today: string,
): WorkstreamView[] {
  const views = workstreams
    .filter((w) => w.projectId === projectId)
    .map((workstream) => {
      const own = tasks.filter((t) => t.workstreamId === workstream.id).sort((a, b) => a.position - b.position);
      return {
        workstream,
        tasks: own,
        state: workstreamState(own, today),
        done: own.filter(isDone).length,
        total: own.length,
      };
    });
  const rank = (s: WorkstreamState) => WORKSTREAM_STATE_ORDER.indexOf(s);
  return views.sort((a, b) => rank(a.state) - rank(b.state) || a.workstream.position - b.workstream.position);
}

export interface Progress {
  done: number;
  total: number;
  /** Entre 0 et 1 ; `null` sans aucune tâche, pour ne pas afficher un faux 0 %. */
  ratio: number | null;
}

/** L'avancement d'un projet : la part de toutes ses tâches cochées (décision de l'étude, §4.5). */
export function projectProgress(projectId: string, tasks: readonly ProjectTask[]): Progress {
  const own = tasks.filter((t) => t.projectId === projectId);
  const done = own.filter(isDone).length;
  return { done, total: own.length, ratio: own.length === 0 ? null : done / own.length };
}

/** Le jour qui compte pour une tâche : prévu, sinon échéance. */
export const taskDay = (t: ProjectTask): string | null => t.plannedDay ?? t.dueDay;

/** Une tâche restante dont le jour prévu ou l'échéance est passé. */
export function isTaskLate(t: ProjectTask, today: string): boolean {
  if (isDone(t)) return false;
  return (t.plannedDay !== null && t.plannedDay < today) || (t.dueDay !== null && t.dueDay < today);
}

/** Un chantier dont l'échéance est passée sans qu'il soit fini. */
export function isWorkstreamLate(view: WorkstreamView, today: string): boolean {
  return view.workstream.dueDay !== null && view.workstream.dueDay < today && view.state !== 'done' && view.state !== 'empty';
}

/** Un projet dont la mise en ligne promise est passée, des tâches restant à faire. */
export function isProjectLate(project: Project, progress: Progress, today: string): boolean {
  return project.dueDay !== null && project.dueDay < today && progress.done < progress.total;
}

/** Le seuil du « en danger » : une échéance à une semaine ou moins. */
export const RISK_DAYS = 7;

/**
 * Un projet en danger (§4.5) : son échéance tombe dans `RISK_DAYS` jours ou
 * moins et il reste plus de la moitié des tâches, ou l'un de ses chantiers
 * a dépassé sa date. Rend la raison, pour la dire en clair, ou `null`.
 * Un projet déjà en retard n'est pas « en danger » : il est en retard.
 */
export function riskReason(project: Project, views: readonly WorkstreamView[], progress: Progress, today: string): string | null {
  if (isProjectLate(project, progress, today)) return null;
  const lateWs = views.find((v) => isWorkstreamLate(v, today));
  if (lateWs) return `Le chantier « ${lateWs.workstream.title} » a dépassé sa date`;
  if (project.dueDay !== null && progress.total > 0) {
    const left = daysBetween(today, project.dueDay);
    const remaining = progress.total - progress.done;
    if (left >= 0 && left <= RISK_DAYS && remaining * 2 > progress.total) {
      return `Mise en ligne dans ${left} j, ${remaining} tâches sur ${progress.total} restent`;
    }
  }
  return null;
}
