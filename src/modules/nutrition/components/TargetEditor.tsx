import { useEffect, useState } from 'react';
import { dayLabel } from '../lib/day';
import { energyShares, targetKcal, type MacroKey } from '../lib/macros';
import {
  ACTIVITY_LEVELS,
  ANSES_RANGES,
  estimateTarget,
  GOALS,
  PROTEIN_PER_KG,
  type GoalId,
  type Sex,
} from '../lib/targets';
import type { Target, TargetInput } from '../lib/types';

interface Props {
  today: string;
  /** L'objectif en vigueur aujourd'hui, pour pré-remplir */
  current: Target | null;
  /** Tous les objectifs, du plus ancien au plus récent */
  targets: Target[];
  onCancel: () => void;
  onSave: (input: TargetInput) => Promise<void>;
  onDelete: (target: Target) => Promise<void>;
}

const MACRO_FIELDS: { key: MacroKey; label: string; max: number }[] = [
  { key: 'protein', label: 'Protéines (g)', max: 1000 },
  { key: 'carbs', label: 'Glucides (g)', max: 2000 },
  { key: 'fat', label: 'Lipides (g)', max: 1000 },
];

const kcalText = (kcal: number) => kcal.toLocaleString('fr-FR');

/** « aujourd'hui », « hier », « le lundi 21 septembre » — après « Depuis ». */
function sinceText(day: string, today: string): string {
  const label = dayLabel(day, today);
  return /^[A-Z]/.test(label) ? label.toLowerCase() : `le ${label}`;
}

function isGrams(value: string, max: number): boolean {
  const n = Number(value);
  return value.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= max;
}

/**
 * Fixer l'objectif quotidien, en grammes (décision du 25/09/2026, étude §12).
 *
 * On règle les grammes ; les kcal et la part de chaque macro dans l'énergie
 * en sont déduites et affichées à côté, avec le repère ANSES en aide — jamais
 * imposé. Le calculateur ne fait que proposer des grammes : rien n'est
 * enregistré tant qu'on n'a pas validé, et ses données (poids, taille, âge)
 * ne sont stockées nulle part.
 *
 * Un objectif s'applique à partir d'un jour : les jours d'avant gardent
 * celui de leur époque (étude §6).
 */
export function TargetEditor({ today, current, targets, onCancel, onSave, onDelete }: Props) {
  const [grams, setGrams] = useState<Record<MacroKey, string>>({
    protein: current ? String(current.proteinG) : '',
    carbs: current ? String(current.carbsG) : '',
    fat: current ? String(current.fatG) : '',
  });
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Le calculateur, replié par défaut : un objectif connu se tape directement.
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [activity, setActivity] = useState<number>(ACTIVITY_LEVELS[1].factor);
  const [goal, setGoal] = useState<GoalId>('maintain');
  const [proteinPerKg, setProteinPerKg] = useState<number>(PROTEIN_PER_KG[1].value);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const valid = MACRO_FIELDS.every((f) => isGrams(grams[f.key], f.max));
  const values = valid
    ? { proteinG: Number(grams.protein), carbsG: Number(grams.carbs), fatG: Number(grams.fat) }
    : null;
  const kcal = values ? targetKcal(values) : null;
  const shares = values
    ? energyShares({ proteinDg: values.proteinG * 10, carbsDg: values.carbsG * 10, fatDg: values.fatG * 10 })
    : null;

  const profileValid =
    Number(age) >= 15 && Number(age) <= 100 &&
    Number(weight) >= 30 && Number(weight) <= 300 &&
    Number(height) >= 120 && Number(height) <= 230;
  const estimate = profileValid
    ? estimateTarget(
        { sex, age: Number(age), weightKg: Number(weight), heightCm: Number(height) },
        activity,
        goal,
        proteinPerKg,
      )
    : null;

  async function run(action: () => Promise<void>) {
    setSaving(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  function submit() {
    if (!values || kcal === null) {
      setError('Indique les trois quantités en grammes entiers.');
      return;
    }
    if (kcal === 0) {
      setError('Un objectif à 0 kcal n’a pas de sens : indique au moins une quantité.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) {
      setError('Choisis la date à partir de laquelle cet objectif s’applique.');
      return;
    }
    void run(() => onSave({ effectiveFrom, ...values }));
  }

  const history = targets.slice().reverse();

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="modal nutrition-target-editor"
        role="dialog"
        aria-modal="true"
        aria-label="Objectif quotidien"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">Objectif quotidien</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="nutrition-target-fields">
            {MACRO_FIELDS.map((f) => (
              <div className="field" key={f.key}>
                <label htmlFor={`nutrition-target-${f.key}`}>{f.label}</label>
                <input
                  id={`nutrition-target-${f.key}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={f.max}
                  step={1}
                  value={grams[f.key]}
                  onChange={(e) => setGrams((g) => ({ ...g, [f.key]: e.target.value }))}
                />
                <span className="field-hint">
                  {shares ? `${shares[f.key]} % de l’énergie · ` : ''}repère ANSES {ANSES_RANGES[f.key][0]}–
                  {ANSES_RANGES[f.key][1]} %
                </span>
              </div>
            ))}
          </div>

          <p className="nutrition-target-kcal">
            {kcal !== null ? (
              <>
                Soit <b>{kcalText(kcal)} kcal</b> par jour
              </>
            ) : (
              'Les kcal se déduisent des grammes : 4 par gramme de protéines ou de glucides, 9 par gramme de lipides.'
            )}
          </p>

          <div className="field">
            <label htmlFor="nutrition-target-from">À partir du</label>
            <input
              id="nutrition-target-from"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
            <span className="field-hint">Les jours d’avant gardent l’objectif de leur époque.</span>
          </div>

          <details className="nutrition-calculator">
            <summary>M’aider à calculer</summary>
            <p className="field-hint">
              Une estimation (formule de Mifflin-St Jeor), à ±10–15 % près — un point de départ à
              ajuster, pas un avis médical. Ces informations ne sont enregistrées nulle part.
            </p>
            <div className="nutrition-calculator-grid">
              <div className="field">
                <label htmlFor="nutrition-calc-sex">Sexe</label>
                <select id="nutrition-calc-sex" value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
                  <option value="male">Homme</option>
                  <option value="female">Femme</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="nutrition-calc-age">Âge</label>
                <input id="nutrition-calc-age" type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="nutrition-calc-weight">Poids (kg)</label>
                <input id="nutrition-calc-weight" type="number" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="nutrition-calc-height">Taille (cm)</label>
                <input id="nutrition-calc-height" type="number" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="nutrition-calc-activity">Activité</label>
              <select
                id="nutrition-calc-activity"
                value={activity}
                onChange={(e) => setActivity(Number(e.target.value))}
              >
                {ACTIVITY_LEVELS.map((a) => (
                  <option key={a.factor} value={a.factor}>
                    {a.label} — {a.detail}
                  </option>
                ))}
              </select>
            </div>
            <div className="nutrition-calculator-grid">
              <div className="field">
                <label htmlFor="nutrition-calc-goal">But</label>
                <select id="nutrition-calc-goal" value={goal} onChange={(e) => setGoal(e.target.value as GoalId)}>
                  {GOALS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="nutrition-calc-protein">Protéines</label>
                <select
                  id="nutrition-calc-protein"
                  value={proteinPerKg}
                  onChange={(e) => setProteinPerKg(Number(e.target.value))}
                >
                  {PROTEIN_PER_KG.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {estimate ? (
              <div className="nutrition-calculator-result">
                <span>
                  Proposition : <b>{kcalText(estimate.kcal)} kcal</b> — protéines {estimate.proteinG} g, glucides{' '}
                  {estimate.carbsG} g, lipides {estimate.fatG} g
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() =>
                    setGrams({
                      protein: String(estimate.proteinG),
                      carbs: String(estimate.carbsG),
                      fat: String(estimate.fatG),
                    })
                  }
                >
                  Utiliser ces valeurs
                </button>
              </div>
            ) : (
              <p className="field-hint">Renseigne âge, poids et taille pour obtenir une proposition.</p>
            )}
          </details>

          {history.length > 0 && (
            <section className="nutrition-target-history">
              <h3 className="nutrition-results-title">Objectifs enregistrés</h3>
              <ul>
                {history.map((t) => (
                  <li key={t.id} className="nutrition-target-history-row">
                    <span>
                      Depuis {sinceText(t.effectiveFrom, today)} —{' '}
                      <b>{kcalText(targetKcal(t))} kcal</b> ({t.proteinG} / {t.carbsG} / {t.fatG} g)
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-danger"
                      onClick={() => void run(() => onDelete(t))}
                      disabled={saving}
                    >
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {error && <div className="notice error">{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving || !valid}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
