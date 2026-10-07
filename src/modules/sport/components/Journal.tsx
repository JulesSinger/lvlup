import { formatDuration, formatKm, formatPace } from '../lib/format';
import { KIND_LABELS } from '../lib/kinds';
import { paceOf } from '../lib/pace';
import type { Run } from '../lib/types';

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

/** Le journal : les sorties de la plus récente à la plus ancienne, par mois. */
export function Journal({ runs, onOpen }: { runs: Run[]; onOpen: (run: Run) => void }) {
  const sorted = runs.slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const months = new Map<string, Run[]>();
  for (const r of sorted) months.set(r.day.slice(0, 7), [...(months.get(r.day.slice(0, 7)) ?? []), r]);
  return (
    <div className="sport-journal">
      {[...months.entries()].map(([month, list]) => {
        const label = new Date(`${month}-15T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        const total = list.reduce((s, r) => s + r.distanceM, 0);
        return (
          <section key={month} className="sport-month">
            <h2 className="sport-month-title">
              <span>{label}</span>
              <span className="sport-month-total">
                {list.length} sortie{list.length > 1 ? 's' : ''} · {formatKm(total)}
              </span>
            </h2>
            <div className="sport-runs">
              {list.map((r) => (
                <RunRow key={r.id} run={r} onOpen={() => onOpen(r)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
