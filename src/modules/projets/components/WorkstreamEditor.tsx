import { useState } from 'react';
import type { Workstream, WorkstreamPatch } from '../lib/types';
import { validateWorkstreamTitle } from '../lib/validation';
import { Modal } from './Modal';
import { useSaving } from './useSaving';

interface Props {
  /** `null` : un nouveau chantier */
  workstream: Workstream | null;
  taskCount: number;
  onClose: () => void;
  onSave: (patch: Required<Pick<WorkstreamPatch, 'title' | 'dueDay'>>) => Promise<void>;
  onDelete?: () => Promise<void>;
}

/** Créer, renommer, dater ou supprimer un chantier. Le supprimer emporte ses tâches. */
export function WorkstreamEditor({ workstream, taskCount, onClose, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(workstream?.title ?? '');
  const [dueDay, setDueDay] = useState(workstream?.dueDay ?? '');
  const { saving, error, setError, run } = useSaving();

  function submit() {
    const problem = validateWorkstreamTitle(title);
    if (problem) return setError(problem);
    void run(() => onSave({ title: title.trim(), dueDay: dueDay || null }));
  }

  const confirmText =
    taskCount > 0 ? `Supprimer le chantier « ${workstream?.title} » et ses ${taskCount} tâche${taskCount > 1 ? 's' : ''} ?` : `Supprimer le chantier « ${workstream?.title} » ?`;

  return (
    <Modal
      title={workstream ? 'Modifier le chantier' : 'Nouveau chantier'}
      onClose={onClose}
      footer={
        <>
          {workstream && onDelete && (
            <button className="btn btn-ghost btn-sm btn-danger" disabled={saving} onClick={() => window.confirm(confirmText) && void run(onDelete)}>
              Supprimer
            </button>
          )}
          <span className="projets-spacer" />
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {workstream ? 'Enregistrer' : 'Créer'}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="projets-ws-title">Nom</label>
        <input
          id="projets-ws-title"
          value={title}
          placeholder="Développement, Contenus, Hébergement…"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />
      </div>
      <div className="field">
        <label htmlFor="projets-ws-due">À finir pour le</label>
        <input id="projets-ws-due" type="date" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
      </div>
      {error && <div className="notice error">{error}</div>}
    </Modal>
  );
}
