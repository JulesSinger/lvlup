import { useState } from 'react';
import { dueLabel, shortDate } from '../lib/format';
import { formatEuros } from '../lib/money';
import { WORKSTREAM_STATE_LABELS, WORKSTREAM_STATE_ORDER, type Progress, type WorkstreamView } from '../lib/progress';
import { STATUS_LABELS, TRADE_LABELS } from '../lib/status';
import { PROJECT_STATUSES, type Client, type Project, type ProjectNote, type ProjectPatch, type ProjectStatus, type ProjectTask, type Workstream } from '../lib/types';
import { daysBetween } from '../../../core/lib/day';
import { Journal } from './Journal';
import { ProjectInfos } from './ProjectInfos';
import { WaitingBar } from './WaitingBar';
import { WorkstreamBlock } from './WorkstreamBlock';

type Tab = 'workstreams' | 'journal' | 'infos';

interface Props {
  project: Project;
  client: Client | undefined;
  clients: readonly Client[];
  views: readonly WorkstreamView[];
  notes: readonly ProjectNote[];
  progress: Progress;
  today: string;
  onBack: () => void;
  /** Pour l'onglet Infos : l'erreur remonte et s'affiche dans le formulaire. */
  onPatch: (patch: ProjectPatch) => Promise<void>;
  /** Pour le statut et l'attente : l'erreur va dans le bandeau commun. */
  onQuickPatch: (patch: ProjectPatch) => Promise<void>;
  onDelete: () => Promise<void>;
  onToggleTask: (task: ProjectTask) => void;
  onOpenTask: (task: ProjectTask) => void;
  onAddTask: (workstreamId: string, title: string) => Promise<void>;
  /** `null` : un nouveau chantier */
  onEditWorkstream: (workstream: Workstream | null) => void;
  onAddNote: (day: string, text: string) => Promise<void>;
  onDeleteNote: (note: ProjectNote) => Promise<void>;
}

/**
 * La fiche d'un projet : le client, le statut de la relation, l'attente du
 * client, l'avancement ; puis les chantiers rangés par état, le journal et
 * les infos du projet.
 */
export function ProjectSheet(props: Props) {
  const { project, client, views, progress, today } = props;
  const [tab, setTab] = useState<Tab>('workstreams');
  const daysLeft = project.dueDay ? daysBetween(today, project.dueDay) : null;

  const groups = WORKSTREAM_STATE_ORDER.map((state) => ({ state, items: views.filter((v) => v.state === state) })).filter((g) => g.items.length > 0);

  return (
    <div className="projets-sheet">
      <button className="btn btn-ghost btn-sm projets-back" onClick={props.onBack}>
        ← Retour
      </button>
      <div className="projets-sheet-head">
        <div className="projets-sheet-id">
          <p className="projets-sheet-client">
            {client?.name ?? 'Client inconnu'}
            {client && <span> · {TRADE_LABELS[client.trade]}</span>}
            {client?.phone && (
              <>
                {' · '}
                <a href={`tel:${client.phone.replace(/\s/g, '')}`}>{client.phone}</a>
              </>
            )}
          </p>
          <h1 className="projets-sheet-title">{project.title}</h1>
          <div className="projets-sheet-meta">
            <select
              className="projets-status-select"
              aria-label="Statut du projet"
              value={project.status}
              onChange={(e) => void props.onQuickPatch({ status: e.target.value as ProjectStatus })}
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            {project.dueDay && (
              <span className={`projets-when${daysLeft !== null && daysLeft < 0 && progress.done < progress.total ? ' late' : ''}`}>
                Mise en ligne le {shortDate(project.dueDay, today)} ({dueLabel(daysLeft!)})
              </span>
            )}
            {project.priceCents !== null && <span className="projets-price">{formatEuros(project.priceCents)}</span>}
          </div>
        </div>
        <div className="projets-sheet-progress" aria-label="Avancement">
          <b>{progress.ratio === null ? '—' : `${Math.round(progress.ratio * 100)} %`}</b>
          <span>
            {progress.done} / {progress.total} tâches
          </span>
        </div>
      </div>

      <WaitingBar
        project={project}
        today={today}
        onChange={(what) => props.onQuickPatch(what === null ? { waitingFor: null } : { waitingFor: what, waitingSince: today })}
      />

      <nav className="projets-subtabs" role="tablist" aria-label="Fiche du projet">
        {(
          [
            ['workstreams', 'Chantiers'],
            ['journal', `Journal${props.notes.length ? ` (${props.notes.length})` : ''}`],
            ['infos', 'Infos'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`projets-subtab${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'workstreams' && (
        <div className="projets-workstreams">
          {views.length === 0 && <p className="projets-hint">Aucun chantier. Ajoute le premier : Contenus, Développement, Hébergement…</p>}
          {groups.map(({ state, items }) => (
            <div key={state} className="projets-ws-group">
              <h2 className="projets-section-title">
                {WORKSTREAM_STATE_LABELS[state]} <span className="projets-count">{items.length}</span>
              </h2>
              {items.map((view) => (
                <WorkstreamBlock
                  key={view.workstream.id}
                  view={view}
                  today={today}
                  onToggle={props.onToggleTask}
                  onOpenTask={props.onOpenTask}
                  onAddTask={(title) => props.onAddTask(view.workstream.id, title)}
                  onEdit={() => props.onEditWorkstream(view.workstream)}
                />
              ))}
            </div>
          ))}
          <button className="btn btn-ghost btn-sm projets-add-ws" onClick={() => props.onEditWorkstream(null)}>
            + Ajouter un chantier
          </button>
        </div>
      )}

      {tab === 'journal' && <Journal notes={props.notes} today={today} onAdd={props.onAddNote} onDelete={props.onDeleteNote} />}

      {tab === 'infos' && <ProjectInfos key={project.id} project={project} clients={props.clients} onSave={props.onPatch} onDelete={props.onDelete} />}
    </div>
  );
}
