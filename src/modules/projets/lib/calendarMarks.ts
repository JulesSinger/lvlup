/**
 * Le calque de Projets dans Calendar — bibliothèque pure (docs/etude-projets.md
 * §6, étape 6). Ce que les projets savent des jours :
 *
 *  · les **tâches** prévues (ou à échéance), cochables et déplaçables à un autre jour ;
 *  · la **mise en ligne** promise d'un projet, et la date de fin d'un **chantier** ;
 *  · les **paiements attendus**, pas encore reçus.
 *
 * Les projets terminés ou perdus n'y paraissent plus. Les tâches de projet se
 * font à la journée : elles n'ont pas d'heure (§3.3).
 */
import type { CalendarMark } from '../../../core/lib/services';
import { formatEuros } from './money';
import { isClosed } from './status';
import type { Client, Payment, Project, ProjectTask, Workstream } from './types';

export interface MarksData {
  clients: readonly Client[];
  projects: readonly Project[];
  workstreams: readonly Workstream[];
  tasks: readonly ProjectTask[];
  payments: readonly Payment[];
}

/** Ce qu'une marque désigne, lu depuis son identifiant. */
export type MarkTarget =
  | { kind: 'task'; id: string }
  | { kind: 'due'; id: string }
  | { kind: 'ws'; id: string }
  | { kind: 'pay'; id: string };

export function markTarget(markId: string): MarkTarget | null {
  const m = /^(task|due|ws|pay):(.+)$/.exec(markId);
  return m ? ({ kind: m[1], id: m[2] } as MarkTarget) : null;
}

export function projectMarks(data: MarksData, from: string, to: string): CalendarMark[] {
  const projects = new Map(data.projects.filter((p) => !isClosed(p.status)).map((p) => [p.id, p]));
  const client = new Map(data.clients.map((c) => [c.id, c.name]));
  const ws = new Map(data.workstreams.map((w) => [w.id, w]));
  const who = (p: Project) => client.get(p.clientId) ?? p.title;
  const inRange = (day: string | null): day is string => day !== null && day >= from && day <= to;
  const marks: CalendarMark[] = [];

  for (const task of data.tasks) {
    const project = projects.get(task.projectId);
    const day = task.plannedDay ?? task.dueDay;
    if (!project || !inRange(day)) continue;
    marks.push({
      id: `task:${task.id}`,
      day,
      title: `${task.plannedDay ? '' : '⚑ '}${who(project)} · ${task.title}`,
      detail: [project.title, ws.get(task.workstreamId)?.title, task.waitingClient ? 'attend le client' : ''].filter(Boolean).join(' · '),
      checkable: true,
      done: task.completedAt !== null,
      // Une tâche à faire, qui a un jour prévu, se glisse à un autre jour.
      movable: task.plannedDay !== null && task.completedAt === null,
      link: `task:${task.id}`,
    });
  }

  for (const project of projects.values()) {
    if (inRange(project.dueDay)) {
      marks.push({ id: `due:${project.id}`, day: project.dueDay, title: `🚀 Mise en ligne — ${who(project)}`, detail: project.title, movable: true, link: `project:${project.id}` });
    }
  }

  for (const w of data.workstreams) {
    const project = projects.get(w.projectId);
    if (!project || !inRange(w.dueDay)) continue;
    marks.push({ id: `ws:${w.id}`, day: w.dueDay, title: `Fin du chantier « ${w.title} » — ${who(project)}`, detail: project.title, movable: true, link: `project:${project.id}` });
  }

  for (const p of data.payments) {
    const project = projects.get(p.projectId);
    if (!project || p.receivedDay !== null || !inRange(p.expectedDay)) continue;
    marks.push({
      id: `pay:${p.id}`,
      day: p.expectedDay,
      title: `💶 ${p.label} attendu — ${who(project)}`,
      detail: `${formatEuros(p.amountCents)} · ${project.title}`,
      movable: true,
      link: `project:${project.id}`,
    });
  }

  return marks.sort((a, b) => a.day.localeCompare(b.day) || a.title.localeCompare(b.title, 'fr'));
}
