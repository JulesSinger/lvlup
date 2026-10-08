import { mondayOf } from '../../../core/lib/day';
import { formatDuration, formatKm, formatPace, formatTime } from '../lib/format';
import { paceOf, riegel } from '../lib/pace';
import { bestEfforts, recentReference, weeklyVolumes } from '../lib/stats';
import type { ReactNode } from 'react';
import { HALF_MARATHON_M, MARATHON_M, type Run, type SportSettings } from '../lib/types';
import { suggestedHrMax } from '../lib/zones';
import { HeartRateCard } from './HeartRateCard';
import { PlanSummary } from './PlanView';
import type { WeekStatus } from '../lib/planView';
import type { Plan } from '../lib/types';
import { RunRow, shortDay } from './Journal';

const DISTANCE_LABELS: Record<number, string> = { 1000: '1 km', 5000: '5 km', 10_000: '10 km', [HALF_MARATHON_M]: 'Semi', [MARATHON_M]: 'Marathon' };

/**
 * Le tableau de bord (docs/etude-sport.md §5) : cette semaine, la tendance
 * des douze dernières, la dernière sortie, les records, une prédiction pour le
 * marathon, et la fréquence cardiaque. Le plan en cours en tête (étape 4).
 */
export function Dashboard({ runs, settings, today, onOpen, onSaveHr, plan, onCreatePlan, children }: {
  runs: Run[];
  settings: SportSettings;
  today: string;
  onOpen: (run: Run) => void;
  onSaveHr: (patch: Pick<SportSettings, 'hrMax' | 'hrRest'>) => Promise<void>;
  /** Le plan en cours, en tête du tableau de bord (étape 4). */
  plan: { plan: Plan; weeks: WeekStatus[]; onOpen: () => void } | null;
  onCreatePlan: () => void;
  /** Les panneaux des liens avec les autres modules (Objectifs), en bas. */
  children?: ReactNode;
}) {
  const weeks = weeklyVolumes(runs, today, 12);
  const week = weeks[weeks.length - 1];
  const maxWeek = Math.max(...weeks.map((w) => w.distanceM), 1);
  const last = runs.reduce<Run | null>((a, r) => (!a || r.startedAt > a.startedAt ? r : a), null);
  const records = bestEfforts(runs);
  const reference = recentReference(runs, today);

  return (
    <div className="sport-dash">
      {plan ? (
        <PlanSummary plan={plan.plan} weeks={plan.weeks} today={today} onOpen={plan.onOpen} />
      ) : (
        <section className="sport-panel sport-plan-summary">
          <h2 className="sport-panel-title">Marathon</h2>
          <p className="sport-hint">Un plan semaine par semaine jusqu’à la course, construit sur ce que tu cours aujourd’hui.</p>
          <button className="btn btn-sm btn-primary" onClick={onCreatePlan}>
            Créer le plan
          </button>
        </section>
      )}
      <section className="sport-panel sport-week">
        <h2 className="sport-panel-title">Cette semaine</h2>
        <div className="sport-stats">
          <div className="sport-stat">
            <span className="sport-stat-value">{formatKm(week.distanceM)}</span>
            <span className="sport-stat-label">courus</span>
          </div>
          <div className="sport-stat">
            <span className="sport-stat-value">{week.runs}</span>
            <span className="sport-stat-label">sortie{week.runs > 1 ? 's' : ''}</span>
          </div>
          <div className="sport-stat">
            <span className="sport-stat-value">{formatDuration(week.durationS)}</span>
            <span className="sport-stat-label">en tout</span>
          </div>
        </div>
        <div className="sport-weeks" role="img" aria-label={`Kilomètres des 12 dernières semaines : ${weeks.map((w) => Math.round(w.distanceM / 1000)).join(', ')}`}>
          {weeks.map((w) => (
            <span key={w.monday} className={`sport-weeks-col${w.monday === mondayOf(today) ? ' sport-weeks-now' : ''}`} title={`Semaine du ${shortDay(w.monday)} : ${formatKm(w.distanceM)}`}>
              <span className="sport-weeks-km">{w.distanceM > 0 ? Math.round(w.distanceM / 1000) : ''}</span>
              <span className="sport-weeks-bar" style={{ height: w.distanceM > 0 ? `${Math.max(6, (w.distanceM / maxWeek) * 100)}%` : '2px' }} />
            </span>
          ))}
        </div>
        <div className="sport-weeks-axis" aria-hidden="true">
          <span>{shortDay(weeks[0].monday)}</span>
          <span>cette semaine</span>
        </div>
      </section>

      {last && (
        <section className="sport-panel sport-last">
          <h2 className="sport-panel-title">Dernière sortie</h2>
          <RunRow run={last} onOpen={() => onOpen(last)} />
        </section>
      )}

      <section className="sport-panel">
        <h2 className="sport-panel-title">Records</h2>
        {records.length === 0 ? (
          <p className="sport-hint">Ils apparaîtront avec tes sorties.</p>
        ) : (
          <table className="sport-records">
            <tbody>
              {records.map((e) => (
                <tr key={e.distanceM}>
                  <th scope="row">{DISTANCE_LABELS[e.distanceM]}</th>
                  <td className="sport-record-time">{formatTime(e.timeS)}</td>
                  <td>{formatPace(paceOf(e.distanceM, e.timeS) ?? 0)}</td>
                  <td className="sport-record-day">
                    {shortDay(e.day)}
                    {e.within ? ' · dans une sortie' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {reference && (
          <p className="sport-prediction">
            Au marathon : <b>≈ {formatTime(riegel(reference.distanceM, reference.timeS, MARATHON_M))}</b>, d’après ton{' '}
            {DISTANCE_LABELS[reference.distanceM]} du {shortDay(reference.day)} (formule de Riegel). Une estimation, souvent
            optimiste sur le marathon : l’entraînement dira le reste.
          </p>
        )}
      </section>

      <HeartRateCard settings={settings} suggestedMax={suggestedHrMax(runs)} onSave={onSaveHr} />
      {children}
    </div>
  );
}
