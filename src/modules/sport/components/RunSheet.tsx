import { formatDuration, formatKm, formatPace } from '../lib/format';
import { KIND_LABELS, SOURCE_LABELS } from '../lib/kinds';
import { paceOf } from '../lib/pace';
import type { PlanSession, Run } from '../lib/types';
import { runTitle } from './Journal';
import { zoneOf, ZONE_LABELS, type HrZone } from '../lib/zones';
import { Modal } from './Modal';

/** « jeudi 1 octobre 2026 à 07:30 » */
export function longDate(run: Run): string {
  const d = new Date(run.startedAt);
  const day = new Date(`${run.day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `${day} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
}

/** La fiche d'une sortie : tout ce qu'on en sait, et ses temps au kilomètre quand un fichier les a donnés. */
export function RunSheet({ run, zones, onClose, onEdit, onDelete, plan }: {
  run: Run;
  zones: HrZone[] | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /**
   * Les séances du plan de la semaine de cette sortie, la séance à laquelle
   * elle se rattache d'elle-même, et de quoi en choisir une autre.
   */
  plan?: { sessions: PlanSession[]; auto: PlanSession | null; onAssign: (sessionId: string | null) => void };
}) {
  const pace = paceOf(run.distanceM, run.durationS);
  const zone = run.avgHr !== null ? zoneOf(run.avgHr, zones) : null;
  const splits = run.splitsS ?? [];
  const fastest = splits.length > 0 ? Math.min(...splits) : 0;

  return (
    <Modal
      title={runTitle(run)}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost btn-sm btn-danger" onClick={() => window.confirm('Supprimer cette sortie ?') && onDelete()}>
            Supprimer
          </button>
          <span className="sport-spacer" />
          <button className="btn" onClick={onEdit}>
            Modifier
          </button>
        </>
      }
    >
      <p className="sport-sheet-date">
        {longDate(run)} · <span className={`sport-kind sport-kind-${run.kind}`}>{KIND_LABELS[run.kind]}</span>
      </p>
      <div className="sport-stats">
        <div className="sport-stat">
          <span className="sport-stat-value">{formatKm(run.distanceM)}</span>
          <span className="sport-stat-label">distance</span>
        </div>
        <div className="sport-stat">
          <span className="sport-stat-value">{formatDuration(run.durationS)}</span>
          <span className="sport-stat-label">durée</span>
        </div>
        {pace !== null && (
          <div className="sport-stat">
            <span className="sport-stat-value">{formatPace(pace)}</span>
            <span className="sport-stat-label">allure</span>
          </div>
        )}
        {run.avgHr !== null && (
          <div className="sport-stat">
            <span className="sport-stat-value">{run.avgHr} bpm</span>
            <span className="sport-stat-label">
              FC moyenne{zone ? ` · zone ${zone} (${ZONE_LABELS[zone - 1].toLowerCase()})` : ''}
            </span>
          </div>
        )}
        {run.maxHr !== null && (
          <div className="sport-stat">
            <span className="sport-stat-value">{run.maxHr} bpm</span>
            <span className="sport-stat-label">FC max</span>
          </div>
        )}
        {run.elevationM !== null && (
          <div className="sport-stat">
            <span className="sport-stat-value">{run.elevationM} m</span>
            <span className="sport-stat-label">dénivelé</span>
          </div>
        )}
        {run.effort !== null && (
          <div className="sport-stat">
            <span className="sport-stat-value">{run.effort} / 10</span>
            <span className="sport-stat-label">ressenti</span>
          </div>
        )}
      </div>

      {splits.length > 0 && (
        <table className="sport-splits">
          <caption>Temps au kilomètre</caption>
          <thead>
            <tr>
              <th scope="col">Km</th>
              <th scope="col">Allure</th>
              <th scope="col" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {splits.map((s, i) => (
              <tr key={i} className={s === fastest ? 'sport-split-best' : undefined}>
                <td>{i + 1}</td>
                <td>{formatPace(s)}</td>
                <td className="sport-split-bar-cell" aria-hidden="true">
                  <span className="sport-split-bar" style={{ width: `${Math.round((fastest / s) * 100)}%` }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {plan && plan.sessions.length > 0 && (
        <div className="field sport-sheet-plan">
          <label htmlFor="sport-run-session">Séance du plan</label>
          <select id="sport-run-session" value={run.sessionId ?? ''} onChange={(e) => plan.onAssign(e.target.value || null)}>
            <option value="">Automatique{plan.auto && !run.sessionId ? ` (${plan.auto.title})` : ''}</option>
            {plan.sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
                {s.distanceM !== null ? ` · ${formatKm(s.distanceM)}` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {run.note && <p className="sport-sheet-note">{run.note}</p>}
      <p className="sport-sheet-source">{SOURCE_LABELS[run.source]}</p>
    </Modal>
  );
}
