import { useMemo, useState } from 'react';
import { findTimers } from '../lib/timers';
import { isTimed, minutesLabel, schedule, withIds } from '../lib/schedule';
import { guessTiming } from '../lib/stepGuess';
import { STATION_MAX, STATIONS, type Step } from '../lib/types';
import { Modal } from './Modal';
import { extraStations, PlanView, stationColor } from './PlanView';

/** La valeur du menu « Commence » : `launch`, `prev`, `end:<id>`, `start:<id>`. */
function startValue(step: Step): string {
  if (!step.start) return 'prev';
  if (step.start.after === 'launch') return 'launch';
  return `${step.start.after}:${step.start.of}`;
}

/**
 * « ⏱ Régler les temps » (docs/etude-recettes.md §20) : pour chaque étape, le
 * poste, la durée, « ça cuit tout seul » ou « tu es dessus », et ce qui la
 * déclenche. Une recette encore sans réglage s'ouvre sur une proposition tirée
 * du texte, dite « à vérifier ». Le plan se redessine en direct en dessous.
 * Un clic à côté ne ferme pas : rien de réglé ne se perd.
 */
export function TimingEditor({ steps: initial, onSave, onClose }: { steps: Step[]; onSave: (steps: Step[]) => Promise<void>; onClose: () => void }) {
  const wasTimed = isTimed(initial);
  const [steps, setSteps] = useState<Step[]>(() => (wasTimed ? withIds(initial) : guessTiming(initial)));
  const [guessed, setGuessed] = useState(!wasTimed);
  const [otherFor, setOtherFor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const plan = useMemo(() => schedule(steps), [steps]);
  const extras = extraStations(plan.slots);

  const patch = (id: string, change: Partial<Step>) => setSteps((list) => list.map((s) => (s.id === id ? { ...s, ...change } : s)));
  const label = (i: number) => `${i + 1}. ${steps[i].text.length > 30 ? `${steps[i].text.slice(0, 30)}…` : steps[i].text}`;

  function setStart(step: Step, value: string) {
    if (value === 'prev') return patch(step.id!, { start: undefined });
    if (value === 'launch') return patch(step.id!, { start: { after: 'launch' } });
    const [kind, of] = value.split(':');
    patch(step.id!, kind === 'end' ? { start: { after: 'end', of } } : { start: { after: 'start', of, offset: step.start?.after === 'start' ? step.start.offset : 0 } });
  }

  async function save() {
    if (plan.loops.length > 0) return setError('Deux étapes s’attendent l’une l’autre : change ce qui déclenche l’une d’elles.');
    setSaving(true);
    setError('');
    try {
      await onSave(steps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  const keyOf = new Map(plan.slots.map((s) => [s.key, s.index]));

  return (
    <Modal
      title="Régler les temps"
      onClose={onClose}
      className="recettes-timing-editor"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      {guessed && (
        <p className="recettes-timing-guessed" role="status">
          ✨ Proposé d’après le texte : à vérifier, étape par étape.
        </p>
      )}
      <div className="recettes-timing-tools">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setSteps((list) => guessTiming(list));
            setGuessed(true);
          }}
        >
          ✨ Compléter d’après le texte
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setSteps(initial.map((s) => ({ text: s.text })));
            setGuessed(false);
          }}
        >
          Tout effacer
        </button>
      </div>
      <ol className="recettes-timing-steps">
        {steps.map((step, i) => {
          const custom = step.station && !(STATIONS as readonly string[]).includes(step.station);
          const timer = findTimers(step.text)[0];
          return (
            <li key={step.id} className="recettes-timing-step">
              <p className="recettes-timing-text">
                <b>{i + 1}.</b> {step.text}
              </p>
              <div className="recettes-timing-fields">
                <div className="recettes-timing-stations" role="group" aria-label={`Poste de l’étape ${i + 1}`}>
                  {[...STATIONS, ...(custom ? [step.station!] : [])].map((name) => (
                    <button
                      key={name}
                      type="button"
                      className={`recettes-chip${step.station === name ? ' on' : ''}`}
                      style={{ ['--c' as string]: stationColor(name, extras) }}
                      aria-pressed={step.station === name}
                      onClick={() => patch(step.id!, { station: step.station === name ? null : name })}
                    >
                      <i aria-hidden="true" />
                      {name}
                    </button>
                  ))}
                  {otherFor === step.id ? (
                    <input
                      className="recettes-timing-other"
                      aria-label={`Autre poste pour l’étape ${i + 1}`}
                      maxLength={STATION_MAX}
                      autoFocus
                      placeholder="Barbecue, wok…"
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.stopPropagation();
                          setOtherFor(null);
                        }
                        if (e.key !== 'Enter') return;
                        const v = e.currentTarget.value.trim();
                        if (v) patch(step.id!, { station: v });
                        setOtherFor(null);
                      }}
                      onBlur={(e) => {
                        const v = e.currentTarget.value.trim();
                        if (v) patch(step.id!, { station: v });
                        setOtherFor(null);
                      }}
                    />
                  ) : (
                    <button type="button" className="recettes-chip" onClick={() => setOtherFor(step.id!)}>
                      + Autre
                    </button>
                  )}
                </div>

                <label className="recettes-timing-minutes">
                  <span>Durée</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0.5}
                    max={1440}
                    step={0.5}
                    aria-label={`Durée de l’étape ${i + 1}, en minutes`}
                    value={step.minutes ?? ''}
                    placeholder={timer ? String(Math.round(timer.seconds / 60)) : '—'}
                    onChange={(e) => {
                      const v = e.target.value === '' ? null : Number(e.target.value.replace(',', '.'));
                      patch(step.id!, { minutes: v !== null && Number.isFinite(v) && v > 0 ? Math.min(1440, v) : null });
                    }}
                  />
                  <span>min</span>
                </label>

                <div className="recettes-timing-hands" role="group" aria-label={`Pendant l’étape ${i + 1}`}>
                  <button type="button" className={`recettes-chip${step.hands === false ? ' on' : ''}`} aria-pressed={step.hands === false} onClick={() => patch(step.id!, { hands: false })}>
                    🔥 ça cuit tout seul
                  </button>
                  <button type="button" className={`recettes-chip${step.hands === true ? ' on' : ''}`} aria-pressed={step.hands === true} onClick={() => patch(step.id!, { hands: true })}>
                    ✋ tu es dessus
                  </button>
                </div>

                <label className="recettes-timing-start">
                  <span>Commence</span>
                  <select aria-label={`Quand commence l’étape ${i + 1}`} value={startValue(step)} onChange={(e) => setStart(step, e.target.value)}>
                    <option value="launch">au lancement</option>
                    {i > 0 && <option value="prev">après l’étape d’avant</option>}
                    {steps.map((other, j) =>
                      j === i ? null : (
                        <option key={`end:${other.id}`} value={`end:${other.id}`}>
                          à la fin de l’étape {label(j)}
                        </option>
                      ),
                    )}
                    {steps.map((other, j) =>
                      j === i ? null : (
                        <option key={`start:${other.id}`} value={`start:${other.id}`}>
                          pendant l’étape {label(j)}
                        </option>
                      ),
                    )}
                  </select>
                  {step.start?.after === 'start' && (
                    <span className="recettes-timing-offset">
                      au bout de
                      <input
                        type="number"
                        min={0}
                        max={1440}
                        step={0.5}
                        aria-label={`Minutes après le début de l’étape ${(keyOf.get(step.start.of) ?? 0) + 1}`}
                        value={step.start.offset}
                        onChange={(e) => {
                          const v = Number(e.target.value.replace(',', '.'));
                          if (step.start?.after === 'start') patch(step.id!, { start: { ...step.start, offset: Number.isFinite(v) && v >= 0 ? Math.min(1440, v) : 0 } });
                        }}
                      />
                      min
                    </span>
                  )}
                </label>
              </div>
            </li>
          );
        })}
      </ol>

      {plan.conflicts.map((c) => {
        const a = plan.slots.find((s) => s.key === c.a)!;
        const b = plan.slots.find((s) => s.key === c.b)!;
        return (
          <p key={`${c.a}-${c.b}`} className="notice recettes-timing-conflict">
            ✋ Entre {minutesLabel(Math.round(c.from))} et {minutesLabel(Math.round(c.to))}, deux choses à faire de tes mains : l’étape {a.index + 1} et l’étape{' '}
            {b.index + 1}. Fais partir l’une à la fin de l’autre ?
          </p>
        );
      })}
      {plan.loops.length > 0 && <p className="notice error">Deux étapes s’attendent l’une l’autre : change ce qui déclenche l’une d’elles.</p>}
      {error && <div className="notice error">{error}</div>}

      {isTimed(steps) && (
        <section className="recettes-timing-preview" aria-label="Le plan">
          <h3 className="recettes-group-title">Le plan</h3>
          <PlanView plan={plan} />
        </section>
      )}
    </Modal>
  );
}
