import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react';
import { dayLabel, dueLabel, timeRangeLabel } from '../lib/format';
import { TASK_TITLE_MAX, type Task } from '../lib/types';
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
  /** En attente de réseau (étape 7) : enregistrée sur l'appareil, pas encore envoyée */
  waiting?: boolean;
  onToggle: (task: Task) => void;
  onOpen: (task: Task) => void;
  /** Renommer sur place, en touchant le titre (une tâche ou une sous-tâche). */
  onRename?: (task: Task, title: string) => Promise<void>;
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
 *
 * Le texte est du texte : il se sélectionne et se copie. La fenêtre de la
 * tâche s'ouvre par le bouton ✎ du bout de la ligne (demande de Jules,
 * 28/09/2026 : toute la ligne ouvrait la fenêtre, on ne pouvait rien
 * sélectionner). Depuis le 11/10/2026, **toucher le titre le modifie sur
 * place** (`InlineTitle`) — sans rien ôter à la sélection.
 */
export function TaskRow({ task, subtasks, today, listName, showDay, pending, waiting, onToggle, onOpen, onRename, handle }: Props) {
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
        <div className="taches-row-body">
          <InlineTitle task={task} className="taches-row-title" disabled={pending} onRename={onRename} />
          <span className="taches-row-meta">
            {task.priority !== 'normale' && (
              <span className={`taches-flag ${task.priority}`}>{task.priority === 'urgente' ? '!! Urgente' : '! Importante'}</span>
            )}
            {showDay && task.plannedDay && <span className={late ? 'taches-late' : ''}>{dayLabel(task.plannedDay, today)}</span>}
            {task.plannedTime && <span>{timeRangeLabel(task.plannedTime, task.durationMinutes)}</span>}
            {task.dueDay && <span className={`taches-due ${due ?? ''}`}>⚑ {dueLabel(task.dueDay, today)}</span>}
            {task.recurrence && <span title="Tâche répétée">↻</span>}
            {listName && <span className="taches-row-list"># {listName}</span>}
            {task.note && <span title={task.note}>📝</span>}
            {waiting && (
              <span className="taches-waiting" title="Enregistrée sur cet appareil, envoyée au retour du réseau">
                ⏳ en attente d’envoi
              </span>
            )}
          </span>
        </div>
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
        <button type="button" className="taches-edit" aria-label={`Modifier « ${task.title} »`} title="Modifier" onClick={() => onOpen(task)}>
          <span aria-hidden="true">✎</span>
        </button>
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
              <InlineTitle task={s} className="taches-subtask-title" disabled={false} onRename={onRename} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Le délai d'un double-clic : un toucher seul attend ce temps avant de passer en modification. */
const DOUBLE_CLICK_MS = 260;

/**
 * Le titre d'une tâche, modifiable sur place (demande de Jules, 11/10/2026),
 * sans rien ôter à la sélection (demande du 28/09/2026) :
 *  · un **clic simple** ouvre la modification, le curseur là où l'on a
 *    touché — après le délai d'un double-clic, pour ne pas le confondre ;
 *  · un **double ou triple clic** sélectionne un mot ou la ligne, comme
 *    avant ; **glisser** sélectionne aussi : rien ne s'ouvre quand du texte
 *    est sélectionné ;
 *  · **Entrée** ou quitter le champ enregistre ; **Échap** annule ; un titre
 *    vidé n'est pas enregistré (on supprime par la fenêtre ✎).
 */
function InlineTitle({
  task,
  className,
  disabled,
  onRename,
}: {
  task: Task;
  className: string;
  disabled: boolean;
  onRename?: (task: Task, title: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (draft === null || !input.current) return;
    input.current.focus();
    const at = caret ?? draft.length;
    input.current.setSelectionRange(at, at);
    // Seulement à l'ouverture : ensuite, le curseur est à l'utilisateur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft === null]);

  if (!onRename) return <span className={className}>{task.title}</span>;

  function click(e: MouseEvent<HTMLSpanElement>) {
    window.clearTimeout(timer.current);
    if (disabled || e.detail > 1) return; // double ou triple clic : on sélectionne
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim()) return; // un glisser a sélectionné
    const at = selection && selection.anchorNode && e.currentTarget.contains(selection.anchorNode) ? selection.anchorOffset : null;
    timer.current = window.setTimeout(() => {
      const now = window.getSelection();
      if (now && !now.isCollapsed && now.toString().trim()) return;
      done.current = false;
      setCaret(at);
      setDraft(task.title);
    }, DOUBLE_CLICK_MS);
  }

  async function finish(save: boolean) {
    if (done.current || draft === null) return;
    done.current = true;
    const title = draft.trim();
    setDraft(null);
    if (!save || !title || title === task.title) return;
    await onRename?.(task, title).catch(() => undefined);
  }

  if (draft !== null) {
    return (
      <input
        ref={input}
        className={`${className} taches-row-title-input`}
        value={draft}
        maxLength={TASK_TITLE_MAX}
        aria-label={`Modifier le titre de « ${task.title} »`}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void finish(true);
          } else if (e.key === 'Escape') {
            // Échap ferme le champ, pas une fenêtre ouverte derrière.
            e.preventDefault();
            e.stopPropagation();
            void finish(false);
          }
        }}
        onBlur={() => void finish(true)}
      />
    );
  }
  return (
    <span className={`${className} taches-row-title-editable`} onClick={click} title="Toucher pour modifier">
      {task.title}
    </span>
  );
}
