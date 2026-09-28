import { timeRangeLabel } from '../lib/format';
import type { Task } from '../lib/types';

interface Props {
  task: Task;
  onOpen: (task: Task) => void;
}

/**
 * La prochaine fois d'une tâche répétée, en aperçu dans « À venir » (demande
 * de Jules, 28/09/2026). Pas de case : on coche l'occurrence en cours, et
 * celle-ci prend sa place. ✎ ouvre la tâche elle-même, sa règle comprise.
 */
export function ForecastRow({ task, onOpen }: Props) {
  return (
    <li className="taches-row taches-forecast">
      <div className="taches-row-main">
        <span className="taches-forecast-dot" aria-hidden="true" />
        <div className="taches-row-body">
          <span className="taches-row-title">{task.title}</span>
          <span className="taches-row-meta">
            {task.plannedTime && <span>{timeRangeLabel(task.plannedTime, task.durationMinutes)}</span>}
            <span title={task.repeatFrom === 'completion' ? 'Si elle est faite à temps' : undefined}>↻ prochaine fois</span>
          </span>
        </div>
        <button type="button" className="taches-edit" aria-label={`Modifier « ${task.title} »`} title="Modifier la tâche et sa répétition" onClick={() => onOpen(task)}>
          <span aria-hidden="true">✎</span>
        </button>
      </div>
    </li>
  );
}
