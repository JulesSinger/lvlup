import { useState } from 'react';
import type { ProjectTask, ProjectTaskPatch, Workstream } from '../lib/types';
import { validateTask } from '../lib/validation';
import { Modal } from './Modal';
import { useSaving } from './useSaving';

interface Props {
  task: ProjectTask;
  /** Les chantiers du projet, pour y déplacer la tâche. */
  workstreams: readonly Workstream[];
  onClose: () => void;
  onSave: (patch: ProjectTaskPatch) => Promise<void>;
  onDelete: () => Promise<void>;
}

/** Modifier une tâche : titre, note, jour prévu, échéance, attente du client, chantier. */
export function TaskEditor({ task, workstreams, onClose, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note);
  const [plannedDay, setPlannedDay] = useState(task.plannedDay ?? '');
  const [dueDay, setDueDay] = useState(task.dueDay ?? '');
  const [waitingClient, setWaitingClient] = useState(task.waitingClient);
  const [workstreamId, setWorkstreamId] = useState(task.workstreamId);
  const { saving, error, setError, run } = useSaving();

  function submit() {
    const patch = {
      title: title.trim(),
      note,
      plannedDay: plannedDay || null,
      dueDay: dueDay || null,
      waitingClient,
      workstreamId,
    };
    const problem = validateTask({ ...patch, projectId: task.projectId });
    if (problem) return setError(problem);
    void run(() => onSave(patch));
  }

  return (
    <Modal
      title="Modifier la tâche"
      onClose={onClose}
      footer={
        <>
          <button
            className="btn btn-ghost btn-sm btn-danger"
            disabled={saving}
            onClick={() => window.confirm(`Supprimer la tâche « ${task.title} » ?`) && void run(onDelete)}
          >
            Supprimer
          </button>
          <span className="projets-spacer" />
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            Enregistrer
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="projets-task-title">Tâche</label>
        <input id="projets-task-title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} autoFocus />
      </div>
      <div className="projets-field-row">
        <div className="field">
          <label htmlFor="projets-task-planned">Prévue le</label>
          <input id="projets-task-planned" type="date" value={plannedDay} onChange={(e) => setPlannedDay(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="projets-task-due">Échéance</label>
          <input id="projets-task-due" type="date" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="projets-task-ws">Chantier</label>
        <select id="projets-task-ws" value={workstreamId} onChange={(e) => setWorkstreamId(e.target.value)}>
          {workstreams.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title}
            </option>
          ))}
        </select>
      </div>
      <label className="projets-check">
        <input type="checkbox" checked={waitingClient} onChange={(e) => setWaitingClient(e.target.checked)} />
        <span>⏳ Elle attend quelque chose du client</span>
      </label>
      <div className="field">
        <label htmlFor="projets-task-note">Note</label>
        <textarea id="projets-task-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <div className="notice error">{error}</div>}
    </Modal>
  );
}
