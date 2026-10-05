import { useState } from 'react';
import { centsToInput, parseEuros } from '../lib/money';
import { templateById } from '../lib/templates';
import type { Client, Project, ProjectPatch } from '../lib/types';
import { validateProject } from '../lib/validation';
import { useSaving } from './useSaving';

interface Props {
  project: Project;
  clients: readonly Client[];
  onSave: (patch: ProjectPatch) => Promise<void>;
  onDelete: () => Promise<void>;
}

/** L'onglet « Infos » : ce qui définit le projet, et le supprimer. */
export function ProjectInfos({ project, clients, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(project.title);
  const [clientId, setClientId] = useState(project.clientId);
  const [startDay, setStartDay] = useState(project.startDay ?? '');
  const [dueDay, setDueDay] = useState(project.dueDay ?? '');
  const [price, setPrice] = useState(centsToInput(project.priceCents));
  const [note, setNote] = useState(project.note);
  const [saved, setSaved] = useState(false);
  const { saving, error, setError, run } = useSaving();
  const choosable = clients.filter((c) => !c.archived || c.id === project.clientId);

  function submit() {
    const priceCents = parseEuros(price);
    if (priceCents === undefined) return setError('Le prix doit être un montant positif, par exemple 900 ou 1 250,50.');
    const patch = { title: title.trim(), clientId, startDay: startDay || null, dueDay: dueDay || null, priceCents, note };
    const problem = validateProject(patch);
    if (problem) return setError(problem);
    setSaved(false);
    void run(async () => {
      await onSave(patch);
      setSaved(true);
    });
  }

  return (
    <div className="projets-infos">
      <div className="field">
        <label htmlFor="projets-infos-title">Titre</label>
        <input id="projets-infos-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="projets-infos-client">Client</label>
        <select id="projets-infos-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          {choosable.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="projets-field-row">
        <div className="field">
          <label htmlFor="projets-infos-start">Début</label>
          <input id="projets-infos-start" type="date" value={startDay} onChange={(e) => setStartDay(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="projets-infos-due">Mise en ligne prévue</label>
          <input id="projets-infos-due" type="date" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="projets-infos-price">Prix (€)</label>
          <input id="projets-infos-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="projets-infos-note">Note</label>
        <textarea id="projets-infos-note" rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <p className="projets-hint">
        Projet n° {project.number}
        {templateById(project.template) ? ` · parti du modèle « ${templateById(project.template)!.label} »` : ''}
      </p>
      {error && <div className="notice error">{error}</div>}
      {saved && !error && (
        <div className="notice success" role="status">
          Enregistré.
        </div>
      )}
      <div className="projets-infos-actions">
        <button
          className="btn btn-ghost btn-sm btn-danger"
          disabled={saving}
          onClick={() => window.confirm(`Supprimer le projet « ${project.title} », ses chantiers, ses tâches et son journal ?`) && void run(onDelete)}
        >
          Supprimer le projet
        </button>
        <span className="projets-spacer" />
        <button className="btn btn-primary" onClick={submit} disabled={saving}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}
