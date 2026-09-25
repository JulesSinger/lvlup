import { energyShares, targetKcal, type NutrientValues } from '../lib/macros';
import type { Target } from '../lib/types';

interface Props {
  total: NutrientValues;
  target: Target | null;
}

const MACROS = [
  { key: 'protein', label: 'Protéines', dg: 'proteinDg', g: 'proteinG' },
  { key: 'carbs', label: 'Glucides', dg: 'carbsDg', g: 'carbsG' },
  { key: 'fat', label: 'Lipides', dg: 'fatDg', g: 'fatG' },
] as const;

const kcalText = (kcal: number) => kcal.toLocaleString('fr-FR');

/**
 * Le total du jour : kcal, puis chaque macronutriment en grammes, avec sa
 * part de l'énergie.
 *
 * Face à un objectif, une barre se remplit — et s'arrête pleine au-delà,
 * sans virer au rouge : un voyant d'alerte ne change rien au comportement
 * et peut culpabiliser (docs/etude-nutrition.md §8). Le dépassement se lit
 * dans les chiffres, dans la même teinte que le reste.
 */
export function DaySummary({ total, target }: Props) {
  const shares = energyShares(total);
  const goalKcal = target ? targetKcal(target) : null;

  return (
    <section className="nutrition-summary" aria-label="Total du jour">
      <div className="nutrition-summary-kcal">
        <b className="nutrition-summary-kcal-value">{kcalText(total.kcal)}</b>
        <span className="nutrition-summary-kcal-unit">
          {goalKcal !== null ? ` / ${kcalText(goalKcal)} kcal` : ' kcal'}
        </span>
      </div>
      {goalKcal !== null && <Bar value={total.kcal} goal={goalKcal} className="kcal" />}

      <div className="nutrition-summary-macros">
        {MACROS.map((m) => {
          const grams = Math.round(total[m.dg] / 10);
          const goal = target ? target[m.g] : null;
          return (
            <div key={m.key} className={`nutrition-summary-macro ${m.key}`}>
              <span className="nutrition-summary-macro-label">{m.label}</span>
              <span className="nutrition-summary-macro-grams">
                {grams} g{goal !== null && <span className="nutrition-summary-macro-goal"> / {goal} g</span>}
              </span>
              {goal !== null && <Bar value={grams} goal={goal} className={m.key} />}
              <span className="nutrition-summary-macro-share" title="Part de l'énergie apportée">
                {shares[m.key]} % de l’énergie
              </span>
            </div>
          );
        })}
      </div>

      {target === null && (
        <p className="nutrition-summary-hint">
          Pas encore d’objectif quotidien : les totaux s’affichent seuls pour l’instant.
        </p>
      )}
    </section>
  );
}

function Bar({ value, goal, className }: { value: number; goal: number; className: string }) {
  const percent = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return (
    <span className="nutrition-bar" aria-hidden="true">
      <span className={`nutrition-bar-fill ${className}`} style={{ width: `${percent}%` }} />
    </span>
  );
}
