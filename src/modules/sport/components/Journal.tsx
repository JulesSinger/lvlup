import { formatDuration, formatKm, formatPace } from '../lib/format';
import { CROSS_LABELS, KIND_LABELS } from '../lib/kinds';
import { paceOf } from '../lib/pace';
import type { Activity, Run } from '../lib/types';

/** « jeu. 1 oct. » */
export const shortDay = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * Le titre d'une sortie : le sien, sinon sa sorte. Un titre qui ne fait que
 * répéter la sorte (« Footing », comme Strava les nomme souvent) n'est pas
 * doublé d'une étiquette « Footing ».
 */
export function runTitle(run: Run): string {
  const own = run.title.trim();
  return own && own.toLowerCase() !== KIND_LABELS[run.kind].toLowerCase() ? own : KIND_LABELS[run.kind];
}

/** Une ligne de sortie : jour, titre, distance, durée, allure, FC. */
export function RunRow({ run, onOpen }: { run: Run; onOpen: () => void }) {
  const pace = paceOf(run.distanceM, run.durationS);
  const title = runTitle(run);
  return (
    <button type="button" className="sport-run" onClick={onOpen}>
      <span className="sport-run-day">{shortDay(run.day)}</span>
      <span className="sport-run-main">
        <span className="sport-run-title">{title}</span>
        {title !== KIND_LABELS[run.kind] && <span className={`sport-kind sport-kind-${run.kind}`}>{KIND_LABELS[run.kind]}</span>}
      </span>
      <span className="sport-run-figures">
        <b>{formatKm(run.distanceM)}</b>
        <span>{formatDuration(run.durationS)}</span>
        {pace !== null && <span>{formatPace(pace)}</span>}
        {run.avgHr !== null && <span>♥ {run.avgHr}</span>}
      </span>
    </button>
  );
}

/** Une séance de renforcement ou de vélo dans le journal : jour, titre, durée, distance pour le vélo, FC. */
export function ActivityRow({ activity, onOpen }: { activity: Activity; onOpen: () => void }) {
  const label = CROSS_LABELS[activity.sport];
  const own = activity.title.trim();
  const title = own && own.toLowerCase() !== label.toLowerCase() ? own : label;
  return (
    <button type="button" className="sport-run sport-run-activity" onClick={onOpen}>
      <span className="sport-run-day">{shortDay(activity.day)}</span>
      <span className="sport-run-main">
        <span className="sport-run-title">
          <span aria-hidden="true">{activity.sport === 'renfo' ? '💪 ' : '🚴 '}</span>
          {title}
        </span>
        {title !== label && <span className={`sport-kind sport-kind-${activity.sport}`}>{label}</span>}
      </span>
      <span className="sport-run-figures">
        {activity.distanceM !== null && activity.distanceM > 0 && <b>{formatKm(activity.distanceM)}</b>}
        <span>{formatDuration(activity.durationS)}</span>
        {activity.avgHr !== null && <span>♥ {activity.avgHr}</span>}
      </span>
    </button>
  );
}

type Entry = { at: string; day: string; run?: Run; activity?: Activity };

/**
 * Le journal : les sorties de la plus récente à la plus ancienne, par mois ;
 * depuis le 12/10/2026, avec les séances de renfo et de vélo venues de
 * Strava, à leur place dans le temps mais hors du total de kilomètres.
 */
export function Journal({ runs, activities = [], onOpen, onOpenActivity }: {
  runs: Run[];
  activities?: Activity[];
  onOpen: (run: Run) => void;
  onOpenActivity?: (activity: Activity) => void;
}) {
  const entries: Entry[] = [
    ...runs.map((run) => ({ at: run.startedAt, day: run.day, run })),
    ...activities.map((activity) => ({ at: activity.startedAt, day: activity.day, activity })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const months = new Map<string, Entry[]>();
  for (const e of entries) months.set(e.day.slice(0, 7), [...(months.get(e.day.slice(0, 7)) ?? []), e]);
  return (
    <div className="sport-journal">
      {[...months.entries()].map(([month, list]) => {
        const label = new Date(`${month}-15T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        const monthRuns = list.flatMap((e) => (e.run ? [e.run] : []));
        const others = list.length - monthRuns.length;
        const total = monthRuns.reduce((s, r) => s + r.distanceM, 0);
        return (
          <section key={month} className="sport-month">
            <h2 className="sport-month-title">
              <span>{label}</span>
              <span className="sport-month-total">
                {monthRuns.length} sortie{monthRuns.length > 1 ? 's' : ''} · {formatKm(total)}
                {others > 0 && ` · ${others} séance${others > 1 ? 's' : ''} d’à côté`}
              </span>
            </h2>
            <div className="sport-runs">
              {list.map((e) =>
                e.run ? (
                  <RunRow key={e.run.id} run={e.run} onOpen={() => onOpen(e.run!)} />
                ) : (
                  <ActivityRow key={e.activity!.id} activity={e.activity!} onOpen={() => onOpenActivity?.(e.activity!)} />
                ),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
