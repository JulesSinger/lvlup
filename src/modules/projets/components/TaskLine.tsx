import { projectColor } from '../lib/colors';
import { dayLabel } from '../lib/format';
import { isTaskLate, taskDay } from '../lib/progress';
import type { Project, ProjectTask } from '../lib/types';

interface Props {
  task: ProjectTask;
  today: string;
  /** Dans une liste mêlée (tableau de bord), le projet en étiquette. */
  project?: Project;
  clientName?: string;
  /** Ce qui précède l'étiquette du projet : le chantier. */
  workstreamTitle?: string;
  onToggle: (task: ProjectTask) => void;
  onOpen: (task: ProjectTask) => void;
}

/**
 * Une tâche : le rond coche, le titre ouvre la fenêtre. Le texte reste
 * sélectionnable (leçon de Tâches : une ligne entière en bouton empêche de
 * copier un numéro).
 */
export function TaskLine({ task, today, project, clientName, workstreamTitle, onToggle, onOpen }: Props) {
  const done = task.completedAt !== null;
  const day = taskDay(task);
  const late = isTaskLate(task, today);
  return (
    <li className={`projets-task${done ? ' done' : ''}`}>
      <button
        type="button"
        className="projets-check-btn"
        aria-label={done ? `Décocher « ${task.title} »` : `Cocher « ${task.title} »`}
        aria-pressed={done}
        onClick={() => onToggle(task)}
      />
      <div className="projets-task-main">
        <span className="projets-task-title">{task.title}</span>
        {(project || task.waitingClient || task.note) && (
          <span className="projets-task-meta">
            {project && (
              <span className="projets-tag" style={{ ['--c' as string]: projectColor(project.number) }}>
                {clientName ?? project.title}
              </span>
            )}
            {workstreamTitle && <span>{workstreamTitle}</span>}
            {task.waitingClient && !done && <span className="projets-waiting-tag">⏳ attend le client</span>}
            {task.note && <span aria-label="Note">📝</span>}
          </span>
        )}
      </div>
      {day && !done && <span className={`projets-when${late ? ' late' : ''}`}>{dayLabel(day, today)}</span>}
      <button type="button" className="btn btn-ghost btn-sm projets-edit-btn" aria-label={`Modifier « ${task.title} »`} title="Modifier" onClick={() => onOpen(task)}>
        ✎
      </button>
    </li>
  );
}
