import { useCallback, useEffect, useRef, useState } from 'react';
import { newId } from '../../../core/data/coreStore';
import { dayString } from '../../../core/lib/day';
import type { MarkEditorProps, MarkSlot } from '../../../core/lib/services';
import { tachesStore } from '../data';
import { applyCompletion } from '../data/applyPlans';
import { syncReminders } from '../data/syncReminders';
import { applyPendingTasks } from '../data/taskOutbox';
import { taskWriter } from '../data/taskWriter';
import { effectiveTaskReminders } from '../lib/reminders';
import { completionPlan } from '../lib/repeat';
import { DEFAULT_TACHES_SETTINGS, type TachesSettings, type Task, type TaskInput, type TaskList, type TaskPatch } from '../lib/types';
import { validateTask } from '../lib/validation';
import { subtasksOf } from '../lib/views';
import { TaskEditor } from './TaskEditor';

/** Une tâche pas encore enregistrée, posée sur le créneau touché dans le calendrier. */
function draftTask(id: string, slot: MarkSlot | undefined, today: string): Task {
  const time = slot?.time ?? null;
  return {
    id,
    listId: null,
    parentId: null,
    title: slot?.title ?? '',
    note: '',
    plannedDay: slot?.day ?? today,
    plannedTime: time,
    durationMinutes: time ? (slot?.duration ?? null) : null,
    reminders: null,
    dueDay: null,
    priority: 'normale',
    recurrence: null,
    repeatFrom: 'schedule',
    position: 0,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
}

/**
 * La fenêtre d'une tâche, prêtée au calendrier (`CalendarSource.Editor`,
 * 06/10/2026) : la même que dans Tâches, ouverte par-dessus le calendrier
 * pour modifier une tâche (`link` « task:<id> ») ou en créer une sur un
 * créneau. Elle écrit par le même rédacteur que l'écran de Tâches — file hors
 * ligne comprise — et recalcule les rappels après chaque écriture.
 */
export function CalendarTaskEditor({ link, slot, header, onClose }: MarkEditorProps) {
  const today = dayString();
  const [data, setData] = useState<{ tasks: Task[]; lists: TaskList[]; settings: TachesSettings } | null>(null);
  const [problem, setProblem] = useState('');
  const [draftId] = useState(newId);
  const changed = useRef(false);

  const load = useCallback(async () => {
    const [lists, tasks, settings] = await Promise.all([tachesStore.listLists(), tachesStore.listTasks(), tachesStore.getSettings()]);
    setData({ lists, tasks: applyPendingTasks(tasks, taskWriter.pending()), settings });
  }, []);

  useEffect(() => {
    load().catch((err) => setProblem(err instanceof Error ? err.message : 'Chargement impossible.'));
  }, [load]);

  const close = useCallback(() => onClose(changed.current), [onClose]);

  /** Après une écriture qui garde la fenêtre ouverte (une sous-tâche) : relire, et suivre les rappels. */
  async function wrote() {
    changed.current = true;
    await load();
    syncReminders().catch(() => {});
  }

  /** Après une écriture qui ferme la fenêtre. */
  async function done() {
    syncReminders().catch(() => {});
    onClose(true);
  }

  const id = link?.startsWith('task:') ? link.slice(5) : null;
  const existing = id && data ? data.tasks.find((t) => t.id === id) : undefined;

  // Pendant le chargement, le voile reste en place : rien ne doit laisser
  // réapparaître le calendrier entre deux fenêtres (la bascule « Événement /
  // Tâche » clignotait, 06/10/2026). Une tâche nouvelle n'attend même pas :
  // elle n'a besoin que du créneau, listes et réglages arrivent ensuite.
  if (id && !data && !problem) return <div className="overlay" onClick={close} />;

  if ((id && !existing) || (!id && problem && !data)) {
    const message = problem || 'Cette tâche n’existe plus.';
    return (
      <div className="overlay" onClick={close}>
        <div className="modal" role="dialog" aria-modal="true" aria-label="Tâche" onClick={(e) => e.stopPropagation()}>
          <div className="modal-body">
            <div className="notice error">{message}</div>
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={close}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  const task = existing ?? draftTask(draftId, slot, today);
  const isNew = !existing;
  const tasks = data?.tasks ?? [];

  async function save(patch: TaskPatch) {
    if (isNew) {
      const input: TaskInput = { ...patch, title: patch.title ?? '' };
      await taskWriter.createTask(input, draftId);
    } else await taskWriter.updateTask(task.id, patch);
    await done();
  }

  async function addSubtask(title: string) {
    const input: TaskInput = { title, parentId: task.id, listId: task.listId, position: subtasksOf(tasks, task.id).length };
    const problem = validateTask(input, tasks);
    if (problem) throw new Error(problem);
    await taskWriter.createTask(input, newId());
    await wrote();
  }

  async function toggleSubtask(subtask: Task) {
    if (subtask.completedAt) await taskWriter.updateTask(subtask.id, { completedAt: null });
    else await applyCompletion(taskWriter, completionPlan(subtask, [], new Date().toISOString(), today, newId()));
    await wrote();
  }

  return (
    <TaskEditor
      task={task}
      today={today}
      subtasks={subtasksOf(tasks, task.id)}
      allTasks={tasks}
      lists={data?.lists ?? []}
      defaultReminders={effectiveTaskReminders({ reminders: null }, data?.settings ?? DEFAULT_TACHES_SETTINGS)}
      isNew={isNew}
      header={header}
      onCancel={close}
      onSave={save}
      onDelete={async () => {
        await taskWriter.deleteTask(task.id);
        await done();
      }}
      onAddSubtask={addSubtask}
      onToggleSubtask={(s) => void toggleSubtask(s).catch((err) => setProblem(err instanceof Error ? err.message : 'Impossible de cocher.'))}
      onDeleteSubtask={async (s) => {
        await taskWriter.deleteTask(s.id);
        await wrote();
      }}
    />
  );
}
