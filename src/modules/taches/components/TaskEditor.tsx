import { useEffect, useState } from 'react';
import { durationLabel } from '../lib/format';
import { PRIORITIES, type Priority, type Recurrence, type RepeatFrom, type Task, type TaskList, type TaskPatch } from '../lib/types';
import { validateTask } from '../lib/validation';
import { RepeatFields } from './RepeatFields';

interface Props {
  task: Task;
  today: string;
  subtasks: readonly Task[];
  allTasks: readonly Task[];
  lists: readonly TaskList[];
  onCancel: () => void;
  /** Rejette en cas d'échec : la fenêtre reste ouverte et remplie. */
  onSave: (patch: TaskPatch) => Promise<void>;
  onDelete: () => Promise<void>;
  onAddSubtask: (title: string) => Promise<void>;
  onToggleSubtask: (subtask: Task) => void;
  onDeleteSubtask: (subtask: Task) => Promise<void>;
}

/** Les durées proposées ; une durée venue de l'ajout rapide (« pendant 1h10 ») s'y ajoute. */
const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];

const PRIORITY_LABELS: Record<Priority, string> = { normale: 'Normale', importante: 'Importante', urgente: 'Urgente' };

/**
 * Modifier une tâche : titre, note, liste, jour prévu et heure, échéance
 * (facultative et discrète, étude §12), priorité, et ses sous-tâches — qui,
 * elles, s'écrivent aussitôt, sans attendre « Enregistrer ». Et sa
 * répétition (étape 4) : une tâche répétée a besoin d'un jour prévu,
 * aujourd'hui s'il n'y en a pas encore.
 */
export function TaskEditor(props: Props) {
  const { task, today, subtasks, allTasks, lists, onCancel, onSave, onDelete, onAddSubtask, onToggleSubtask, onDeleteSubtask } = props;
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note);
  const [listId, setListId] = useState(task.listId);
  const [plannedDay, setPlannedDay] = useState(task.plannedDay ?? '');
  const [plannedTime, setPlannedTime] = useState(task.plannedTime ?? '');
  const [duration, setDuration] = useState<number | null>(task.durationMinutes);
  const [dueDay, setDueDay] = useState(task.dueDay ?? '');
  const [showDue, setShowDue] = useState(!!task.dueDay);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [recurrence, setRecurrence] = useState<Recurrence | null>(task.recurrence);
  const [repeatFrom, setRepeatFrom] = useState<RepeatFrom>(task.repeatFrom);
  const [newSub, setNewSub] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isSubtask = task.parentId !== null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  async function run(action: () => Promise<void>) {
    setSaving(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  function submit() {
    const patch: TaskPatch = {
      title: title.trim(),
      note: note.trim(),
      listId,
      plannedDay: plannedDay || null,
      plannedTime: plannedDay && plannedTime ? plannedTime : null,
      durationMinutes: plannedDay && plannedTime ? duration : null,
      dueDay: showDue && dueDay ? dueDay : null,
      priority,
      recurrence: isSubtask ? null : recurrence,
      repeatFrom,
    };
    const problem = validateTask({ ...task, ...patch, title: patch.title as string }, allTasks, task.id);
    if (problem) return setError(problem);
    void run(() => onSave(patch));
  }

  async function addSubtask() {
    const value = newSub.trim();
    if (!value) return;
    try {
      await onAddSubtask(value);
      setNewSub('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ajout impossible.');
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal taches-editor" role="dialog" aria-modal="true" aria-label="Modifier la tâche" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{isSubtask ? 'Sous-tâche' : 'Tâche'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label htmlFor="taches-title">Titre</label>
            <input id="taches-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </div>

          {!isSubtask && (
            <>
              <div className="taches-editor-grid">
                <div className="field">
                  <label htmlFor="taches-day">Jour prévu</label>
                  <input id="taches-day" type="date" value={plannedDay} onChange={(e) => setPlannedDay(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="taches-time">Heure</label>
                  <input id="taches-time" type="time" value={plannedTime} onChange={(e) => setPlannedTime(e.target.value)} disabled={!plannedDay} />
                </div>
              </div>
              {plannedDay && plannedTime && (
                <div className="field">
                  <label htmlFor="taches-duration">Durée</label>
                  <select id="taches-duration" value={duration ?? ''} onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Non précisée (30 min dans le calendrier)</option>
                    {[...new Set([...DURATIONS, ...(duration ? [duration] : [])])]
                      .sort((a, b) => a - b)
                      .map((m) => (
                        <option key={m} value={m}>
                          {durationLabel(m)}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <RepeatFields
                value={recurrence}
                repeatFrom={repeatFrom}
                startDay={plannedDay || today}
                onChange={(rule, from) => {
                  setRecurrence(rule);
                  setRepeatFrom(from);
                  if (rule && !plannedDay) setPlannedDay(today);
                }}
              />

              {showDue ? (
                <div className="field">
                  <label htmlFor="taches-due">Échéance — le jour où elle doit être faite</label>
                  <div className="taches-editor-inline">
                    <input id="taches-due" type="date" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowDue(false)}>
                      Retirer
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="taches-link" onClick={() => setShowDue(true)}>
                  + Ajouter une échéance
                </button>
              )}

              <div className="field">
                <label>Priorité</label>
                <div className="taches-priorities" role="radiogroup" aria-label="Priorité">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={priority === p}
                      className={`taches-priority-choice ${p}${priority === p ? ' on' : ''}`}
                      onClick={() => setPriority(p)}
                    >
                      {PRIORITY_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label htmlFor="taches-list">Liste</label>
                <select id="taches-list" value={listId ?? ''} onChange={(e) => setListId(e.target.value || null)}>
                  <option value="">Boîte de réception</option>
                  {lists
                    .filter((l) => !l.archived || l.id === listId)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}

          <div className="field">
            <label htmlFor="taches-note">Note</label>
            <textarea id="taches-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>


          {!isSubtask && (
            <div className="field">
              <label htmlFor="taches-new-subtask">Sous-tâches</label>
              {subtasks.length > 0 && (
                <ul className="taches-editor-subtasks">
                  {subtasks.map((s) => (
                    <li key={s.id} className={s.completedAt ? 'done' : ''}>
                      <button
                        type="button"
                        className="taches-check small"
                        role="checkbox"
                        aria-checked={!!s.completedAt}
                        aria-label={`${s.completedAt ? 'Décocher' : 'Cocher'} « ${s.title} »`}
                        onClick={() => onToggleSubtask(s)}
                      >
                        <span aria-hidden="true">{s.completedAt ? '✓' : ''}</span>
                      </button>
                      <span className="taches-subtask-title">{s.title}</span>
                      <button type="button" className="btn btn-ghost btn-sm" aria-label={`Supprimer « ${s.title} »`} onClick={() => void onDeleteSubtask(s)}>
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <input
                id="taches-new-subtask"
                type="text"
                placeholder="Ajouter une sous-tâche, puis Entrée"
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void addSubtask();
                  }
                }}
              />
            </div>
          )}

          {error && <div className="notice error">{error}</div>}
        </div>

        <div className="modal-foot taches-editor-foot">
          <button
            className="btn btn-ghost btn-sm btn-danger"
            onClick={() => {
              const extra = subtasks.length > 0 ? ` et ses ${subtasks.length} sous-tâche${subtasks.length > 1 ? 's' : ''}` : '';
              if (window.confirm(`Supprimer « ${task.title} »${extra} ?`)) void run(onDelete);
            }}
            disabled={saving}
          >
            Supprimer
          </button>
          <span className="taches-editor-spacer" />
          <button className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
