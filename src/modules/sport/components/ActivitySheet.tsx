import { formatDuration, formatKm } from '../lib/format';
import { CROSS_LABELS } from '../lib/kinds';
import type { Activity, PlanSession } from '../lib/types';
import { shortDay } from './Journal';
import { Modal } from './Modal';

/** « Renforcement », ou le titre que Strava lui a donné s'il dit autre chose. */
export function activityTitle(a: Activity): string {
  const own = a.title.trim();
  return own && own.toLowerCase() !== CROSS_LABELS[a.sport].toLowerCase() ? own : CROSS_LABELS[a.sport];
}

/**
 * La fiche d'une séance de renforcement ou de vélo venue de Strava (12/10/2026) :
 * ce qu'on en sait, et la séance du plan qu'elle a cochée.
 */
export function ActivitySheet({ activity, session, onClose, onDelete }: {
  activity: Activity;
  session: PlanSession | null;
  onClose: () => void;
  onDelete: () => void;
}) {
  const time = new Date(activity.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return (
    <Modal
      title={activityTitle(activity)}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost btn-sm btn-danger" onClick={() => window.confirm('Retirer cette séance du journal ?') && onDelete()}>
            Retirer
          </button>
          <span className="sport-spacer" />
          <button className="btn" onClick={onClose}>
            Fermer
          </button>
        </>
      }
    >
      <p className="sport-hint">
        {CROSS_LABELS[activity.sport]} · {shortDay(activity.day)} à {time} · {activity.source === 'strava' ? 'Strava' : 'saisie à la main'}
      </p>
      <div className="sport-stats">
        <div className="sport-stat">
          <span className="sport-stat-value">{formatDuration(activity.durationS)}</span>
          <span className="sport-stat-label">durée</span>
        </div>
        {activity.distanceM !== null && activity.distanceM > 0 && (
          <div className="sport-stat">
            <span className="sport-stat-value">{formatKm(activity.distanceM)}</span>
            <span className="sport-stat-label">distance</span>
          </div>
        )}
        {activity.avgHr !== null && (
          <div className="sport-stat">
            <span className="sport-stat-value">♥ {activity.avgHr}</span>
            <span className="sport-stat-label">FC moyenne{activity.maxHr !== null ? ` · max ${activity.maxHr}` : ''}</span>
          </div>
        )}
      </div>
      <p className="sport-hint sport-activity-session">
        {session ? (
          <>
            A coché la séance du plan : <b>{session.title}</b>
          </>
        ) : (
          'Aucune séance du plan ne lui correspondait : elle est seulement notée ici.'
        )}
      </p>
      <p className="sport-hint">Elle ne compte pas dans tes kilomètres de course. La retirer ne décoche pas la séance du plan.</p>
    </Modal>
  );
}
