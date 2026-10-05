import { useState } from 'react';
import { daysBetween } from '../../../core/lib/day';
import { sinceLabel } from '../lib/format';
import { NUDGE_DAYS } from '../lib/dashboard';
import type { Project } from '../lib/types';
import { validateWaiting } from '../lib/validation';

interface Props {
  project: Project;
  today: string;
  onChange: (what: string | null) => Promise<void>;
}

/**
 * « En attente du client » (§3.2) : ce qu'on attend, depuis quand. C'est ce
 * qui distingue un projet bloqué d'un projet en retard — et qui dit quand
 * relancer.
 */
export function WaitingBar({ project, today, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [what, setWhat] = useState('');
  const [error, setError] = useState('');

  async function save() {
    const problem = validateWaiting(what);
    if (problem) return setError(problem);
    setError('');
    await onChange(what.trim());
    setEditing(false);
    setWhat('');
  }

  if (project.waitingFor !== null) {
    const days = project.waitingSince ? daysBetween(project.waitingSince, today) : null;
    return (
      <div className={`projets-waitbar${days !== null && days >= NUDGE_DAYS ? ' old' : ''}`} role="status">
        <span aria-hidden="true">⏳</span>
        <span className="projets-waitbar-text">
          En attente du client : <b>{project.waitingFor}</b>
          {days !== null && `, ${sinceLabel(days)}`}
          {days !== null && days >= NUDGE_DAYS && ' — à relancer'}
        </span>
        <button className="btn btn-sm" onClick={() => void onChange(null)}>
          C’est reçu
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="projets-waitbar projets-waitbar-edit">
        <span aria-hidden="true">⏳</span>
        <input
          value={what}
          autoFocus
          aria-label="Ce que tu attends du client"
          placeholder="les photos, la validation de la maquette…"
          onChange={(e) => setWhat(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
        <button className="btn btn-sm btn-primary" onClick={() => void save()}>
          OK
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
          Annuler
        </button>
        {error && <span className="projets-error-inline">{error}</span>}
      </div>
    );
  }

  return (
    <button className="btn btn-ghost btn-sm projets-wait-btn" onClick={() => setEditing(true)}>
      ⏳ J’attends quelque chose du client
    </button>
  );
}
