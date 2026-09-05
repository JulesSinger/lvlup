import { formatAmount } from '../lib/counters';
import { formatDate } from '../lib/progress';
import type { GoalAmountSummary } from '../lib/progress';

/**
 * Le cumul multi-actions d'un objectif, semaine par semaine — « combien de
 * km cette semaine, en tout » (voir CLAUDE.md, journal du 2026-09-06).
 *
 * De simples barres CSS, pas un SVG comme `PPChart` : ce widget vit dans la
 * carte d'un objectif, potentiellement plusieurs à l'écran à la fois, et n'a
 * besoin ni de survol ni de bascule tableau — juste le total et l'allure des
 * dernières semaines.
 */
const WEEKS_SHOWN = 12;

export function GoalAmountChart({ summary, unit }: { summary: GoalAmountSummary; unit: string }) {
  const recent = summary.weeks.slice(-WEEKS_SHOWN);
  const max = Math.max(...recent.map((w) => w.amount), 1);
  const last = recent[recent.length - 1];

  return (
    <div className="goal-amount">
      <div className="goal-amount-head">
        <span className="goal-amount-total">{formatAmount(summary.total, unit)}</span>
        <span className="goal-amount-total-label">depuis le début</span>
      </div>
      <div
        className="goal-amount-bars"
        role="img"
        aria-label={`${formatAmount(last.amount, unit)} cette semaine, ${formatAmount(
          summary.total,
          unit,
        )} depuis le début`}
      >
        {recent.map((w) => (
          <div
            key={w.monday}
            className="goal-amount-bar-col"
            title={`Semaine du ${formatDate(`${w.monday}T12:00:00`)} : ${formatAmount(w.amount, unit)}`}
          >
            {/* Une semaine à zéro ne doit rien dessiner du tout, pas un
                moignon qui ressemblerait à un petit quelque chose. */}
            {w.amount > 0 && (
              <div
                className="goal-amount-bar"
                style={{ height: `${Math.max(4, (w.amount / max) * 100)}%` }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="goal-amount-foot">{formatAmount(last.amount, unit)} cette semaine</div>
    </div>
  );
}
