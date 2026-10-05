import { useState } from 'react';
import { dayLabel } from '../lib/format';
import { isWorkstreamLate, type WorkstreamView } from '../lib/progress';
import type { ProjectTask } from '../lib/types';
import { TaskLine } from './TaskLine';

interface Props {
  view: WorkstreamView;
  today: string;
  onToggle: (task: ProjectTask) => void;
  onOpenTask: (task: ProjectTask) => void;
  onAddTask: (title: string) => Promise<void>;
  onEdit: () => void;
}

/**
 * Un chantier et ses tâches. Ouvert s'il avance, attend le client ou n'a
 * encore aucune tâche ; replié s'il est à faire ou fini — sinon une fiche
 * tout juste tirée d'un modèle déroule ses quarante-cinq tâches d'un coup.
 * L'ajout d'une tâche se fait sur place, Entrée pour valider.
 */
export function WorkstreamBlock({ view, today, onToggle, onOpenTask, onAddTask, onEdit }: Props) {
  const { workstream, tasks, state, done, total } = view;
  const [open, setOpen] = useState(state === 'doing' || state === 'waiting' || state === 'empty');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const late = isWorkstreamLate(view, today);
  const ratio = total === 0 ? 0 : done / total;

  async function add() {
    const title = draft.trim();
    if (!title) return;
    try {
      await onAddTask(title);
      setDraft('');
      setError('');
    } catch (err) {
      // Le titre reste dans le champ : rien de ce qui a été tapé ne se perd.
      setError(err instanceof Error ? err.message : 'La tâche n’a pas pu être ajoutée.');
    }
  }

  return (
    <section className={`projets-ws projets-ws-${state}`} aria-label={`Chantier ${workstream.title}`}>
      <div className="projets-ws-head">
        <button type="button" className="projets-ws-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="projets-ws-chevron" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
          <span className="projets-ws-title">{workstream.title}</span>
          <span className="projets-ws-count">
            {done} / {total}
          </span>
        </button>
        <span className="projets-ws-bar" aria-hidden="true">
          <i style={{ width: `${Math.round(ratio * 100)}%` }} />
        </span>
        {workstream.dueDay && <span className={`projets-when${late ? ' late' : ''}`}>{dayLabel(workstream.dueDay, today)}</span>}
        <button type="button" className="btn btn-ghost btn-sm projets-edit-btn" aria-label={`Modifier le chantier ${workstream.title}`} title="Modifier le chantier" onClick={onEdit}>
          ✎
        </button>
      </div>
      {open && (
        <div className="projets-ws-body">
          {tasks.length > 0 && (
            <ul className="projets-tasks">
              {tasks.map((t) => (
                <TaskLine key={t.id} task={t} today={today} onToggle={onToggle} onOpen={onOpenTask} />
              ))}
            </ul>
          )}
          <input
            className="projets-add-task"
            value={draft}
            placeholder="+ Ajouter une tâche"
            aria-label={`Ajouter une tâche à ${workstream.title}`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void add()}
          />
          {error && <div className="notice error">{error}</div>}
        </div>
      )}
    </section>
  );
}
