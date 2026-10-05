import { projectColor } from '../lib/colors';
import { dueLabel } from '../lib/format';
import type { ProjectCard as Card } from '../lib/dashboard';
import { STATUS_LABELS } from '../lib/status';

interface Props {
  card: Card;
  clientName: string;
  onOpen: () => void;
}

/**
 * Un projet actif sur le tableau de bord : ce qui avance, ce qui attend le
 * client, l'avancement, l'échéance — et le danger dit en clair.
 */
export function ProjectCard({ card, clientName, onOpen }: Props) {
  const { project, progress, workstreams, late, risk, daysLeft } = card;
  const doing = workstreams.filter((w) => w.state === 'doing');
  const waiting = workstreams.filter((w) => w.state === 'waiting');
  const finished = workstreams.filter((w) => w.state === 'done').length;
  return (
    <button type="button" className="projets-card" style={{ ['--c' as string]: projectColor(project.number) }} onClick={onOpen}>
      <span className="projets-card-top">
        <span className="projets-card-client">{clientName}</span>
        <span className="projets-card-title">{project.title}</span>
        <span className={`projets-status projets-status-${project.status}`}>{STATUS_LABELS[project.status]}</span>
        {daysLeft !== null && (
          <span className={`projets-card-due${late ? ' late' : risk ? ' risk' : ''}`}>{late ? `échéance ${dueLabel(daysLeft)}` : `mise en ligne ${dueLabel(daysLeft)}`}</span>
        )}
      </span>
      {(doing.length > 0 || waiting.length > 0 || project.waitingFor) && (
        <span className="projets-chips">
          {doing.map((w) => (
            <span key={w.workstream.id} className="projets-chip projets-chip-doing">
              {w.workstream.title} {w.done}/{w.total}
            </span>
          ))}
          {waiting.map((w) => (
            <span key={w.workstream.id} className="projets-chip projets-chip-waiting">
              ⏳ {w.workstream.title}
            </span>
          ))}
          {project.waitingFor && <span className="projets-chip projets-chip-waiting">⏳ {project.waitingFor}</span>}
        </span>
      )}
      <span className="projets-gauge" aria-hidden="true">
        <i style={{ width: `${Math.round((progress.ratio ?? 0) * 100)}%` }} />
      </span>
      <span className="projets-card-foot">
        <span>
          {progress.done} / {progress.total} tâches
          {finished > 0 && ` · ${finished} chantier${finished > 1 ? 's' : ''} fini${finished > 1 ? 's' : ''}`}
        </span>
        {risk && <span className="projets-risk">⚠ {risk}</span>}
      </span>
    </button>
  );
}
