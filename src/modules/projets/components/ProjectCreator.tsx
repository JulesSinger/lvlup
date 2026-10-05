import { useState } from 'react';
import { centsToInput, parseEuros } from '../lib/money';
import { STATUS_LABELS, TRADE_LABELS } from '../lib/status';
import { PROJECT_TEMPLATES, type TemplateId } from '../lib/templates';
import { CLIENT_TRADES, PROJECT_STATUSES, type Client, type ClientInput, type ClientTrade, type ProjectInput, type ProjectStatus } from '../lib/types';
import { validateClient, validateProject } from '../lib/validation';
import { Modal } from './Modal';
import { useSaving } from './useSaving';

export interface NewProject {
  /** Un client existant, ou un nouveau à créer d'abord. */
  client: { id: string } | { input: ClientInput };
  project: Omit<ProjectInput, 'clientId'>;
  template: TemplateId;
}

interface Props {
  clients: readonly Client[];
  onClose: () => void;
  onCreate: (draft: NewProject) => Promise<void>;
}

const NEW_CLIENT = '__new__';

/**
 * Créer un projet : pour quel client (ou un nouveau, sans quitter la
 * fenêtre), d'après quel modèle, à quel stade de la relation, pour quand et
 * pour combien. Le modèle remplit les chantiers et leurs tâches.
 */
export function ProjectCreator({ clients, onClose, onCreate }: Props) {
  const active = clients.filter((c) => !c.archived);
  const [clientId, setClientId] = useState(active[0]?.id ?? NEW_CLIENT);
  const [clientName, setClientName] = useState('');
  const [trade, setTrade] = useState<ClientTrade>('commerce');
  const [template, setTemplate] = useState<TemplateId>('vitrine');
  const [title, setTitle] = useState('Site vitrine');
  const [titleTouched, setTitleTouched] = useState(false);
  const [status, setStatus] = useState<ProjectStatus>('lead');
  const [dueDay, setDueDay] = useState('');
  const [price, setPrice] = useState(centsToInput(null));
  const { saving, error, setError, run } = useSaving();

  function chooseTemplate(id: TemplateId) {
    setTemplate(id);
    // Le titre suit le modèle tant qu'on ne l'a pas écrit soi-même.
    if (!titleTouched) setTitle(id === 'vide' ? '' : (PROJECT_TEMPLATES.find((t) => t.id === id)?.label ?? ''));
  }

  function submit() {
    const priceCents = parseEuros(price);
    if (priceCents === undefined) return setError('Le prix doit être un montant positif, par exemple 900 ou 1 250,50.');
    const project = { title: title.trim(), template, status, dueDay: dueDay || null, priceCents };
    let client: NewProject['client'];
    if (clientId === NEW_CLIENT) {
      const input = { name: clientName.trim(), trade };
      const problem = validateClient(input);
      if (problem) return setError(problem);
      client = { input };
    } else {
      client = { id: clientId };
    }
    const problem = validateProject({ ...project, clientId: clientId === NEW_CLIENT ? 'nouveau' : clientId });
    if (problem) return setError(problem);
    void run(() => onCreate({ client, project, template }));
  }

  return (
    <Modal
      title="Nouveau projet"
      onClose={onClose}
      className="projets-creator"
      footer={
        <>
          <span className="projets-spacer" />
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            Créer le projet
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="projets-new-client">Client</label>
        <select id="projets-new-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          {active.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={NEW_CLIENT}>+ Nouveau client</option>
        </select>
      </div>
      {clientId === NEW_CLIENT && (
        <div className="projets-field-row">
          <div className="field">
            <label htmlFor="projets-new-client-name">Nom du commerce</label>
            <input id="projets-new-client-name" value={clientName} placeholder="Fleurs de Lou" onChange={(e) => setClientName(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="projets-new-client-trade">Métier</label>
            <select id="projets-new-client-trade" value={trade} onChange={(e) => setTrade(e.target.value as ClientTrade)}>
              {CLIENT_TRADES.map((t) => (
                <option key={t} value={t}>
                  {TRADE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="field">
        <label>Modèle</label>
        <div className="projets-templates" role="radiogroup" aria-label="Modèle">
          {PROJECT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={template === t.id}
              className={`projets-template${template === t.id ? ' on' : ''}`}
              onClick={() => chooseTemplate(t.id)}
            >
              <b>{t.label}</b>
              <span>{t.description}</span>
              <small>
                {t.workstreams.length === 0
                  ? 'aucun chantier'
                  : `${t.workstreams.length} chantiers · ${t.workstreams.reduce((n, w) => n + w.tasks.length, 0)} tâches`}
              </small>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="projets-new-title">Titre</label>
        <input
          id="projets-new-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleTouched(true);
          }}
        />
      </div>
      <div className="projets-field-row">
        <div className="field">
          <label htmlFor="projets-new-status">Où en est la relation</label>
          <select id="projets-new-status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
            {PROJECT_STATUSES.filter((s) => s !== 'done' && s !== 'lost').map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="projets-new-due">Mise en ligne prévue</label>
          <input id="projets-new-due" type="date" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="projets-new-price">Prix (€)</label>
          <input id="projets-new-price" inputMode="decimal" value={price} placeholder="900" onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>
      {error && <div className="notice error">{error}</div>}
    </Modal>
  );
}
