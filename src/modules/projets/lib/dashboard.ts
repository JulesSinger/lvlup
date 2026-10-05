/**
 * Le tableau de bord — bibliothèque pure (docs/etude-projets.md §4.1).
 *
 * Il répond à la question du matin : sur quoi je travaille, qu'est-ce qui
 * brûle, qu'est-ce que j'attends ? Tous projets confondus, sauf ceux qui
 * sont terminés ou perdus.
 */
import { daysBetween, shiftDay } from '../../../core/lib/day';
import {
  isProjectLate,
  isTaskLate,
  isWorkstreamLate,
  projectProgress,
  projectWorkstreams,
  riskReason,
  taskDay,
  type Progress,
  type WorkstreamView,
} from './progress';
import { isClosed, isInWork } from './status';
import type { Project, ProjectTask, Workstream } from './types';

export interface DashboardData {
  projects: readonly Project[];
  workstreams: readonly Workstream[];
  tasks: readonly ProjectTask[];
}

const open = (projects: readonly Project[]) => projects.filter((p) => !isClosed(p.status));
const byId = (projects: readonly Project[]) => new Map(projects.map((p) => [p.id, p]));

export interface DatedTask {
  task: ProjectTask;
  project: Project;
  /** Le jour prévu, sinon l'échéance. */
  day: string;
}

/** Combien de jours compte « cette semaine » : aujourd'hui et les six suivants. */
export const WEEK_DAYS = 7;

/**
 * Les tâches restantes de cette semaine : jour prévu (ou à défaut échéance)
 * d'aujourd'hui à dans six jours. Les retards n'y sont pas, ils ont leur
 * section. Triées par jour, puis par projet, puis par position.
 */
export function weekTasks(data: DashboardData, today: string): DatedTask[] {
  const projects = byId(open(data.projects));
  const last = shiftDay(today, WEEK_DAYS - 1);
  const items: DatedTask[] = [];
  for (const task of data.tasks) {
    const project = projects.get(task.projectId);
    const day = taskDay(task);
    if (!project || task.completedAt !== null || day === null || isTaskLate(task, today)) continue;
    if (day >= today && day <= last) items.push({ task, project, day });
  }
  return items.sort((a, b) => a.day.localeCompare(b.day) || a.project.number - b.project.number || a.task.position - b.task.position);
}

export type LateItem =
  | { kind: 'task'; project: Project; task: ProjectTask; day: string }
  | { kind: 'workstream'; project: Project; workstream: Workstream; day: string }
  | { kind: 'project'; project: Project; day: string };

/** Les retards : tâches, chantiers et projets dont la date est passée. Les plus anciens d'abord. */
export function lateItems(data: DashboardData, today: string): LateItem[] {
  const projects = open(data.projects);
  const index = byId(projects);
  const items: LateItem[] = [];
  for (const task of data.tasks) {
    const project = index.get(task.projectId);
    if (!project || !isTaskLate(task, today)) continue;
    // Le jour dépassé le plus ancien des deux : celui qui a mis la tâche en retard.
    const passed = [task.plannedDay, task.dueDay].filter((d): d is string => d !== null && d < today).sort();
    items.push({ kind: 'task', project, task, day: passed[0] });
  }
  for (const project of projects) {
    for (const view of projectWorkstreams(project.id, data.workstreams, data.tasks, today)) {
      if (isWorkstreamLate(view, today)) items.push({ kind: 'workstream', project, workstream: view.workstream, day: view.workstream.dueDay! });
    }
    if (isProjectLate(project, projectProgress(project.id, data.tasks), today)) items.push({ kind: 'project', project, day: project.dueDay! });
  }
  return items.sort((a, b) => a.day.localeCompare(b.day) || a.project.number - b.project.number);
}

export type WaitingItem =
  | { kind: 'project'; project: Project; what: string; since: string | null; days: number | null }
  | { kind: 'task'; project: Project; task: ProjectTask };

/**
 * Ce qu'on attend du client : l'attente posée sur un projet (avec depuis
 * quand, pour savoir quand relancer), puis les tâches marquées « attend le
 * client ». Les attentes les plus longues d'abord.
 */
export function waitingItems(data: DashboardData, today: string): WaitingItem[] {
  const projects = open(data.projects);
  const index = byId(projects);
  const fromProjects: WaitingItem[] = projects
    .filter((p) => p.waitingFor !== null)
    .map((project) => ({
      kind: 'project' as const,
      project,
      what: project.waitingFor!,
      since: project.waitingSince,
      days: project.waitingSince === null ? null : daysBetween(project.waitingSince, today),
    }))
    .sort((a, b) => (b.days ?? -1) - (a.days ?? -1) || a.project.number - b.project.number);
  const fromTasks: WaitingItem[] = data.tasks
    .filter((t) => t.waitingClient && t.completedAt === null && index.has(t.projectId))
    .map((task) => ({ kind: 'task' as const, project: index.get(task.projectId)!, task }))
    .sort((a, b) => a.project.number - b.project.number || a.task.position - b.task.position);
  return [...fromProjects, ...fromTasks];
}

/** Au-delà, une attente mérite une relance : elle se signale. */
export const NUDGE_DAYS = 7;

export interface ProjectCard {
  project: Project;
  progress: Progress;
  workstreams: WorkstreamView[];
  late: boolean;
  /** Pourquoi le projet est en danger, ou `null`. */
  risk: string | null;
  /** Jours avant l'échéance (négatif : dépassée), `null` sans échéance. */
  daysLeft: number | null;
}

/**
 * Les cartes « Projets actifs » : les projets signés ou en production, les
 * échéances les plus proches d'abord, ceux sans échéance à la fin.
 */
export function activeProjectCards(data: DashboardData, today: string): ProjectCard[] {
  return data.projects
    .filter((p) => isInWork(p.status))
    .map((project) => {
      const progress = projectProgress(project.id, data.tasks);
      const workstreams = projectWorkstreams(project.id, data.workstreams, data.tasks, today);
      return {
        project,
        progress,
        workstreams,
        late: isProjectLate(project, progress, today),
        risk: riskReason(project, workstreams, progress, today),
        daysLeft: project.dueDay === null ? null : daysBetween(today, project.dueDay),
      };
    })
    .sort((a, b) => {
      if (a.project.dueDay === b.project.dueDay) return a.project.number - b.project.number;
      if (a.project.dueDay === null) return 1;
      if (b.project.dueDay === null) return -1;
      return a.project.dueDay.localeCompare(b.project.dueDay);
    });
}
