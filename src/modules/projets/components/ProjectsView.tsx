import { useState } from 'react';
import { projectColor } from '../lib/colors';
import { shortDate } from '../lib/format';
import { projectProgress } from '../lib/progress';
import { CLOSED_STATUSES, STATUS_LABELS } from '../lib/status';
import { PROJECT_STATUSES, type Client, type Project, type ProjectTask } from '../lib/types';

interface Props {
  projects: readonly Project[];
  tasks: readonly ProjectTask[];
  clients: readonly Client[];
  today: string;
  onOpen: (projectId: string) => void;
}

/**
 * Le pipeline (§4.2) : une colonne par statut de la relation, des pistes à
 * la maintenance, colonnes vides comprises — une colonne vide dit aussi
 * quelque chose (« aucun devis en attente »). Sur téléphone, les colonnes
 * s'empilent. Le statut se change dans la fiche ; le glisser d'une colonne à
 * l'autre pourra venir plus tard. Les terminés et les perdus se replient.
 */
export function ProjectsView({ projects, tasks, clients, today, onOpen }: Props) {
  const [showClosed, setShowClosed] = useState(false);
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? 'Client inconnu';
  const closed = projects.filter((p) => CLOSED_STATUSES.includes(p.status));

  const card = (p: Project) => {
    const progress = projectProgress(p.id, tasks);
    return (
      <li key={p.id}>
        <button type="button" className="projets-mini" style={{ ['--c' as string]: projectColor(p.number) }} onClick={() => onOpen(p.id)}>
          <b>{clientName(p.clientId)}</b>
          <span className="projets-mini-title">{p.title}</span>
          <span className="projets-mini-meta">
            {p.dueDay && <span>{shortDate(p.dueDay, today)}</span>}
            {progress.ratio !== null && <span>{Math.round(progress.ratio * 100)} %</span>}
          </span>
          {p.waitingFor && <span className="projets-mini-wait">⏳ {p.waitingFor}</span>}
        </button>
      </li>
    );
  };

  if (projects.length === 0) return <p className="projets-hint">Aucun projet pour l’instant.</p>;

  return (
    <div className="projets-pipeline-wrap">
      <div className="projets-pipeline">
        {PROJECT_STATUSES.filter((s) => !CLOSED_STATUSES.includes(s)).map((status) => {
          const items = projects.filter((p) => p.status === status).sort((a, b) => (a.dueDay ?? '9').localeCompare(b.dueDay ?? '9') || a.number - b.number);
          return (
            <section key={status} className={`projets-lane projets-lane-${status}${items.length === 0 ? ' empty' : ''}`} aria-label={STATUS_LABELS[status]}>
              <h2 className="projets-lane-title">
                {STATUS_LABELS[status]} <span className="projets-count">{items.length}</span>
              </h2>
              {items.length > 0 && <ul className="projets-lane-list">{items.map(card)}</ul>}
            </section>
          );
        })}
      </div>
      {closed.length > 0 && (
        <section className="projets-closed">
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={showClosed} onClick={() => setShowClosed(!showClosed)}>
            {showClosed ? '▾' : '▸'} Terminés et perdus ({closed.length})
          </button>
          {showClosed && <ul className="projets-lane-list projets-closed-list">{closed.sort((a, b) => b.number - a.number).map(card)}</ul>}
        </section>
      )}
    </div>
  );
}
