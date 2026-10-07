import { formatDuration, formatKm, formatPaceRange } from '../lib/format';
import { PHASE_LABELS } from '../lib/plan';
import { daysToRace, nextSession, type SessionStatus, type WeekStatus } from '../lib/planView';
import type { Plan, PlanSession, Run } from '../lib/types';
import { shortDay } from './Journal';

const STATE_MARKS: Record<SessionStatus['state'], string> = {
  faite: '✓',
  'a-faire': '○',
  manquee: '–',
  'a-venir': '·',
};

const STATE_LABELS: Record<SessionStatus['state'], string> = {
  faite: 'faite',
  'a-faire': 'à faire',
  manquee: 'pas faite',
  'a-venir': 'à venir',
};

/** Une séance du plan : ce qu'elle demande, et ce qui a été couru pour elle. */
export function SessionLine({ status, next, onEdit, onOpenRun }: {
  status: SessionStatus;
  next: boolean;
  onEdit: (session: PlanSession) => void;
  onOpenRun: (run: Run) => void;
}) {
  const { session, run, state } = status;
  return (
    <li className={`sport-session sport-session-${state}${next ? ' sport-session-next' : ''}`}>
      <span className="sport-session-mark" title={STATE_LABELS[state]} aria-label={STATE_LABELS[state]}>
        {STATE_MARKS[state]}
      </span>
      <button type="button" className="sport-session-body" onClick={() => onEdit(session)} aria-label={`Modifier la séance ${session.title}`}>
        <span className="sport-session-head">
          <span className="sport-session-title">{session.title}</span>
          {session.distanceM !== null && <b>{formatKm(session.distanceM)}</b>}
          {session.paceMinS !== null && session.paceMaxS !== null && <span>{formatPaceRange(session.paceMinS, session.paceMaxS)}</span>}
          {session.hrZone !== null && <span className="sport-session-zone">Z{session.hrZone}</span>}
          {session.day && <span>{shortDay(session.day)}</span>}
          {next && <span className="sport-session-badge">prochaine</span>}
        </span>
        {session.instructions && <span className="sport-session-instructions">{session.instructions}</span>}
      </button>
      {run && (
        <button type="button" className="sport-session-run" onClick={() => onOpenRun(run)}>
          {shortDay(run.day)} · {formatKm(run.distanceM)} en {formatDuration(run.durationS)}
        </button>
      )}
    </li>
  );
}

/**
 * Le plan marathon (docs/etude-sport.md §12) : la course et son compte à
 * rebours, la semaine en cours avec la séance suivante, puis toutes les
 * semaines, la passée repliée. Toucher une séance la modifie.
 */
export function PlanView({ plan, weeks, today, onEditSession, onOpenRun, onChangeDate, onDelete }: {
  plan: Plan;
  weeks: WeekStatus[];
  today: string;
  onEditSession: (session: PlanSession) => void;
  onOpenRun: (run: Run) => void;
  onChangeDate: () => void;
  onDelete: () => void;
}) {
  const days = daysToRace(plan, today);
  const next = nextSession(weeks);
  const current = weeks.find((w) => w.when === 'en-cours') ?? null;
  const raceLabel = new Date(`${plan.raceDay}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const line = (s: SessionStatus) => (
    <SessionLine key={s.session.id} status={s} next={next?.session.id === s.session.id} onEdit={onEditSession} onOpenRun={onOpenRun} />
  );

  return (
    <div className="sport-plan">
      <section className="sport-panel sport-plan-head">
        <div className="sport-plan-race">
          <h1 className="sport-plan-title">{plan.title}</h1>
          <p className="sport-plan-date">
            {raceLabel}
            {!plan.raceDayConfirmed && <span className="sport-plan-unsure">à confirmer</span>}
          </p>
        </div>
        <div className="sport-plan-countdown">
          <span className="sport-stat-value">{days > 0 ? `J-${days}` : days === 0 ? 'Jour J' : 'Courue'}</span>
          <span className="sport-stat-label">
            {current ? `semaine ${current.week} / ${weeks.length} · ${PHASE_LABELS[current.phase]}` : `${weeks.length} semaines`}
          </span>
        </div>
        <div className="sport-plan-actions">
          <button className="btn btn-sm" onClick={onChangeDate}>
            Changer la date
          </button>
          <button className="btn btn-ghost btn-sm btn-danger" onClick={() => window.confirm('Supprimer ce plan et toutes ses séances ? Tes sorties restent.') && onDelete()}>
            Supprimer le plan
          </button>
        </div>
      </section>

      {current && (
        <section className="sport-panel sport-plan-current">
          <h2 className="sport-panel-title">
            Cette semaine · {PHASE_LABELS[current.phase]}
            {current.recovery ? ' · allégée' : ''}
          </h2>
          <p className="sport-plan-volume">
            <b>{formatKm(current.doneM)}</b> courus sur <b>{formatKm(current.plannedM)}</b> prévus
          </p>
          <ol className="sport-sessions">{current.sessions.map(line)}</ol>
        </section>
      )}

      <section className="sport-plan-weeks">
        {weeks
          .filter((w) => w.when !== 'en-cours')
          .map((w) => {
            const done = w.sessions.filter((s) => s.state === 'faite').length;
            return (
              <details key={w.week} className={`sport-week-item sport-week-${w.when}`} open={w.when === 'a-venir' && w.week === (current?.week ?? 0) + 1}>
                <summary>
                  <span className="sport-week-num">S{w.week}</span>
                  <span className="sport-week-phase">
                    {PHASE_LABELS[w.phase]}
                    {w.recovery ? ' · allégée' : ''}
                  </span>
                  <span className="sport-week-monday">{shortDay(w.monday)}</span>
                  <span className="sport-week-km">{formatKm(w.plannedM)}</span>
                  {w.when === 'passee' && (
                    <span className="sport-week-done">
                      {done}/{w.sessions.length} · {formatKm(w.doneM)} courus
                    </span>
                  )}
                </summary>
                <ol className="sport-sessions">{w.sessions.map(line)}</ol>
              </details>
            );
          })}
      </section>
    </div>
  );
}

/** Le résumé du plan en tête du tableau de bord : où on en est, et ce qui vient. */
export function PlanSummary({ plan, weeks, today, onOpen }: { plan: Plan; weeks: WeekStatus[]; today: string; onOpen: () => void }) {
  const days = daysToRace(plan, today);
  const next = nextSession(weeks);
  const current = weeks.find((w) => w.when === 'en-cours') ?? null;
  return (
    <section className="sport-panel sport-plan-summary">
      <div className="sport-plan-summary-head">
        <h2 className="sport-panel-title">{plan.title}</h2>
        <span className="sport-plan-summary-days">{days > 0 ? `J-${days}` : days === 0 ? 'Jour J' : 'Courue'}</span>
      </div>
      {current && (
        <p className="sport-hint">
          Semaine {current.week} / {weeks.length} · {PHASE_LABELS[current.phase]}
          {current.recovery ? ' (allégée)' : ''} · {formatKm(current.doneM)} sur {formatKm(current.plannedM)}
        </p>
      )}
      {next && (
        <p className="sport-plan-next">
          Prochaine séance : <b>{next.session.title}</b>
          {next.session.distanceM !== null && <> · {formatKm(next.session.distanceM)}</>}
          {next.session.paceMinS !== null && next.session.paceMaxS !== null && <> · {formatPaceRange(next.session.paceMinS, next.session.paceMaxS)}</>}
          {next.week !== current?.week && <> (semaine {next.week})</>}
        </p>
      )}
      <button className="btn btn-sm" onClick={onOpen}>
        Voir le plan
      </button>
    </section>
  );
}

