import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { dayLabel, dueLabel, timeLabel } from '../lib/format';
import type { Task } from '../lib/types';
import { dueStatus } from '../lib/views';

interface Props {
  task: Task;
  subtasks: readonly Task[];
  today: string;
  /** Le nom de sa liste, montré hors de la liste elle-même */
  listName?: string;
  /** Montrer le jour prévu (pas dans « Aujourd'hui » ni dans un jour d'« À venir ») */
  showDay: boolean;
  /** En cours d'écriture : barrée, en attendant */
  pending: boolean;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
  /** Dans une liste : la poignée pour réordonner, au doigt, à la souris ou au clavier (flèches). */
  handle?: {
    dragging: boolean;
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  };
}

/**
 * Une tâche : le rond à cocher, le titre, et ce qui compte d'un coup d'œil —
 * heure, jour, échéance (en rouge si dépassée), liste, priorité, répétition,
 * sous-tâches faites. Les sous-tâches se déplient sous la tâche.
 */
export function TaskRow({ task, subtasks, today, listName, showDay, pending, onToggle, onOpen, handle }: Props) {
  const [open, setOpen] = useState(false);
  const done = subtasks.filter((s) => s.completedAt).length;
  const due = dueStatus(task, today);
  const late = showDay && task.plannedDay !== null && task.plannedDay < today;
  const checked = !!task.completedAt || pending;

  return (
    <li className={`taches-row taches-priority-${task.priority}${checked ? ' done' : ''}${handle?.dragging ? ' dragging' : ''}`} data-task-id={task.id}>
      <div className="taches-row-main">
        {handle && (
          <button
            type="button"
            className="taches-handle"
            aria-label={`Déplacer « ${task.title} » (flèches haut et bas)`}
            title="Glisser pour réordonner"
            onPointerDown={handle.onPointerDown}
            onKeyDown={handle.onKeyDown}
          >
            <span aria-hidden="true">⠿</span>
          </button>
        )}
        <button
          type="button"
          className="taches-check"
          role="checkbox"
          aria-checked={checked}
          aria-label={`${checked ? 'Décocher' : 'Cocher'} « ${task.title} »`}
          onClick={() => onToggle(task)}
          disabled={pending}
        >
          <span aria-hidden="true">{checked ? '✓' : ''}</span>
        </button>
        <button type="button" className="taches-row-body" onClick={() => onOpen(task)}>
          <span className="taches-row-title">{task.title}</span>
          <span className="taches-row-meta">
            {task.priority !== 'normale' && (
              <span className={`taches-flag ${task.priority}`}>{task.priority === 'urgente' ? '!! Urgente' : '! Importante'}</span>
            )}
            {showDay && task.plannedDay && <span className={late ? 'taches-late' : ''}>{dayLabel(task.plannedDay, today)}</span>}
            {task.plannedTime && <span>{timeLabel(task.plannedTime)}</span>}
            {task.dueDay && <span className={`taches-due ${due ?? ''}`}>⚑ {dueLabel(task.dueDay, today)}</span>}
            {task.recurrence && <span title="Tâche répétée">↻</span>}
            {listName && <span className="taches-row-list"># {listName}</span>}
            {task.note && <span title={task.note}>✎</span>}
          </span>
        </button>
        {subtasks.length > 0 && (
          <button
            type="button"
            className="taches-subtoggle"
            aria-expanded={open}
            aria-label={`${open ? 'Replier' : 'Déplier'} les sous-tâches (${done} sur ${subtasks.length})`}
            onClick={() => setOpen(!open)}
          >
            {done}/{subtasks.length} <span aria-hidden="true">{open ? '▾' : '▸'}</span>
          </button>
        )}
      </div>
      {open && subtasks.length > 0 && (
        <ul className="taches-subtasks">
          {subtasks.map((s) => (
            <li key={s.id} className={`taches-subtask${s.completedAt ? ' done' : ''}`}>
              <button
                type="button"
                className="taches-check small"
                role="checkbox"
                aria-checked={!!s.completedAt}
                aria-label={`${s.completedAt ? 'Décocher' : 'Cocher'} « ${s.title} »`}
                onClick={() => onToggle(s)}
              >
                <span aria-hidden="true">{s.completedAt ? '✓' : ''}</span>
              </button>
              <span className="taches-subtask-title">{s.title}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
