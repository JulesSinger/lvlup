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
 * Tous les projets, rangés par statut de la relation — des pistes à la
 * maintenance. Les terminés et les perdus se replient en bas. La vue en
 * colonnes (pipeline) viendra à l'étape 4.
 */
export function ProjectsView({ projects, tasks, clients, today, onOpen }: Props) {
  const [showClosed, setShowClosed] = useState(false);
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? 'Client inconnu';
  const closed = projects.filter((p) => CLOSED_STATUSES.includes(p.status));

  const row = (p: Project) => {
    const progress = projectProgress(p.id, tasks);
    return (
      <li key={p.id}>
        <button type="button" className="projets-row" style={{ ['--c' as string]: projectColor(p.number) }} onClick={() => onOpen(p.id)}>
          <span className="projets-row-main">
            <b>{clientName(p.clientId)}</b>
            <span>{p.title}</span>
          </span>
          {p.waitingFor && <span className="projets-chip projets-chip-waiting">⏳ {p.waitingFor}</span>}
          {p.dueDay && <span className="projets-when">{shortDate(p.dueDay, today)}</span>}
          <span className="projets-row-progress">{progress.ratio === null ? '—' : `${Math.round(progress.ratio * 100)} %`}</span>
        </button>
      </li>
    );
  };

  if (projects.length === 0) return <p className="projets-hint">Aucun projet pour l’instant.</p>;

  return (
    <div className="projets-by-status">
      {PROJECT_STATUSES.filter((s) => !CLOSED_STATUSES.includes(s)).map((status) => {
        const items = projects.filter((p) => p.status === status).sort((a, b) => (a.dueDay ?? '9').localeCompare(b.dueDay ?? '9') || a.number - b.number);
        if (items.length === 0) return null;
        return (
          <section key={status} className="projets-status-group" aria-label={STATUS_LABELS[status]}>
            <h2 className="projets-section-title">
              {STATUS_LABELS[status]} <span className="projets-count">{items.length}</span>
            </h2>
            <ul className="projets-rows">{items.map(row)}</ul>
          </section>
        );
      })}
      {closed.length > 0 && (
        <section className="projets-status-group">
          <button type="button" className="btn btn-ghost btn-sm" aria-expanded={showClosed} onClick={() => setShowClosed(!showClosed)}>
            {showClosed ? '▾' : '▸'} Terminés et perdus ({closed.length})
          </button>
          {showClosed && <ul className="projets-rows">{closed.sort((a, b) => b.number - a.number).map(row)}</ul>}
        </section>
      )}
    </div>
  );
}
