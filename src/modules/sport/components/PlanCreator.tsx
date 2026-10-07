import { useMemo, useState } from 'react';
import { formatKm, formatTime } from '../lib/format';
import { riegel } from '../lib/pace';
import { generatePlan, PHASE_LABELS, type PlanWeek } from '../lib/plan';
import { parseDuration } from '../lib/runForm';
import { longestRecent, recentReference, recentWeeklyAverage } from '../lib/stats';
import { HALF_MARATHON_M, MARATHON_M, type PlanInput, type Run } from '../lib/types';
import { validatePlan } from '../lib/validation';
import { shortDay } from './Journal';
import { Modal } from './Modal';

/** La date provisoire d'Annecy : le dernier dimanche d'avril 2027 (docs/etude-sport.md §12). */
const ANNECY_DAY = '2027-04-25';

const REFERENCE_DISTANCES = [
  [5000, '5 km'],
  [10_000, '10 km'],
  [HALF_MARATHON_M, 'Semi-marathon'],
] as const;

/**
 * Créer le plan marathon (docs/etude-sport.md §4.3, §12). Le plan part de ce
 * que Jules court déjà (les quatre dernières semaines, la plus longue sortie
 * récente) et de son meilleur effort récent, proposé et corrigible. L'aperçu
 * se recalcule à chaque changement, avant que rien ne soit enregistré.
 */
export function PlanCreator({ runs, today, onClose, onCreate }: {
  runs: Run[];
  today: string;
  onClose: () => void;
  onCreate: (input: PlanInput, weeks: PlanWeek[]) => Promise<void>;
}) {
  const found = useMemo(() => recentReference(runs, today), [runs, today]);
  const currentWeeklyM = useMemo(() => recentWeeklyAverage(runs, today), [runs, today]);
  const longestM = useMemo(() => longestRecent(runs, today), [runs, today]);

  const [title, setTitle] = useState('Marathon d’Annecy');
  const [raceDay, setRaceDay] = useState(ANNECY_DAY > today ? ANNECY_DAY : today);
  const [confirmed, setConfirmed] = useState(false);
  const [startDay, setStartDay] = useState(today);
  const [perWeek, setPerWeek] = useState(4);
  const [refDistance, setRefDistance] = useState<number>(found?.distanceM ?? 10_000);
  const [refTime, setRefTime] = useState(found ? formatTime(found.timeS) : '');
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const refS = refTime.trim() ? parseDuration(refTime) : null;
  const reference = refS ? { distanceM: refDistance, timeS: refS } : null;

  const preview = useMemo(() => {
    try {
      return generatePlan({ startDay, raceDay, raceTitle: title.trim() || 'Marathon', sessionsPerWeek: perWeek, reference, currentWeeklyM, longestRecentM: longestM });
    } catch {
      return null;
    }
    // `reference` se reconstruit à chaque rendu : on suit ses deux nombres.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDay, raceDay, title, perWeek, refDistance, refS, currentWeeklyM, longestM]);

  const count = (phase: string) => preview?.filter((w) => w.phase === phase).length ?? 0;
  const peak = preview ? Math.max(...preview.filter((w) => w.phase !== 'course').map((w) => w.volumeM)) : 0;
  const longest = preview
    ? Math.max(...preview.filter((w) => w.phase !== 'course').flatMap((w) => w.sessions.filter((s) => s.kind === 'longue').map((s) => s.distanceM ?? 0)))
    : 0;

  async function submit() {
    if (refTime.trim() && !refS) return setError('Le temps de référence se tape « 50:00 » ou « 1:45:30 ».');
    const targetS = target.trim() ? parseDuration(target) : null;
    if (target.trim() && !targetS) return setError('Le temps espéré se tape « 3:45:00 ».');
    const input: PlanInput = {
      title: title.trim(),
      raceDistanceM: MARATHON_M,
      raceDay,
      raceDayConfirmed: confirmed,
      targetS,
      referenceDistanceM: reference?.distanceM ?? null,
      referenceS: reference?.timeS ?? null,
      sessionsPerWeek: perWeek,
      startDay,
    };
    const problem = validatePlan(input);
    if (problem) return setError(problem);
    if (!preview) return setError('La course est trop proche pour construire un plan.');
    setSaving(true);
    setError('');
    try {
      await onCreate(input, preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Préparer un marathon"
      onClose={onClose}
      footer={
        <>
          <span className="sport-spacer" />
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={saving || !preview}>
            Créer le plan
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="sport-plan-title">Course</label>
        <input id="sport-plan-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="sport-field-row">
        <div className="field">
          <label htmlFor="sport-plan-race">Date de la course</label>
          <input id="sport-plan-race" type="date" value={raceDay} min={today} onChange={(e) => setRaceDay(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="sport-plan-start">Début du plan</label>
          <input id="sport-plan-start" type="date" value={startDay} onChange={(e) => setStartDay(e.target.value)} />
        </div>
      </div>
      <label className="sport-check">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <span>Date officielle (sinon, elle reste « à confirmer » et pourra changer)</span>
      </label>

      <div className="field">
        <span className="sport-label">Séances par semaine</span>
        <div className="sport-choice" role="group" aria-label="Séances par semaine">
          {[3, 4].map((n) => (
            <button key={n} type="button" className={`sport-choice-item${perWeek === n ? ' on' : ''}`} aria-pressed={perWeek === n} onClick={() => setPerWeek(n)}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="sport-field-row">
        <div className="field">
          <label htmlFor="sport-plan-refdist">Temps de référence</label>
          <select id="sport-plan-refdist" value={refDistance} onChange={(e) => setRefDistance(Number(e.target.value))}>
            {REFERENCE_DISTANCES.map(([d, l]) => (
              <option key={d} value={d}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sport-plan-reftime">en</label>
          <input id="sport-plan-reftime" placeholder="50:00" value={refTime} onChange={(e) => setRefTime(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="sport-plan-target">Temps espéré (facultatif)</label>
          <input id="sport-plan-target" placeholder="3:45:00" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
      </div>
      <p className="sport-hint">
        {found
          ? `Proposé d’après ta sortie du ${shortDay(found.day)} : les allures du plan en découlent. Sans temps, les séances se règlent en zones cardiaques.`
          : 'Un temps récent (5 km, 10 km ou semi) donne les allures du plan ; sans temps, les séances se règlent en zones cardiaques.'}
      </p>
      <p className="sport-hint">
        Ces quatre dernières semaines : <b>{formatKm(currentWeeklyM)}</b> par semaine en moyenne
        {longestM > 0 ? (
          <>
            , plus longue sortie <b>{formatKm(longestM)}</b>
          </>
        ) : null}
        . Le plan part de là.
      </p>

      {preview ? (
        <div className="sport-plan-preview" role="status">
          <p>
            <b>{preview.length} semaines</b> :{' '}
            {[
              count('base') ? `${count('base')} de ${PHASE_LABELS.base.toLowerCase()}` : null,
              count('specifique') ? `${count('specifique')} de ${PHASE_LABELS.specifique.toLowerCase()}` : null,
              count('affutage') ? `${count('affutage')} d’${PHASE_LABELS.affutage.toLowerCase()}` : null,
              'la semaine de la course',
            ]
              .filter(Boolean)
              .join(', ')}
            .
          </p>
          <p>
            Jusqu’à <b>{formatKm(peak)}</b> par semaine, sortie longue jusqu’à <b>{formatKm(longest)}</b>, une semaine sur quatre allégée.
          </p>
          {reference && <p>Prédiction aujourd’hui : ≈ {formatTime(riegel(reference.distanceM, reference.timeS, MARATHON_M))} (formule de Riegel, une estimation).</p>}
        </div>
      ) : (
        <p className="sport-error">La course est trop proche pour construire un plan.</p>
      )}
      {error && <p className="sport-error" role="alert">{error}</p>}
    </Modal>
  );
}
