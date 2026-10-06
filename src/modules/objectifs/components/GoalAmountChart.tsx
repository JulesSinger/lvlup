import { useState } from 'react';
import { shortDay } from '../lib/chartTime';
import { formatAmount } from '../lib/counters';
import { formatDate } from '../lib/progress';
import type { GoalAmountSummary } from '../lib/progress';
import { dayString } from '../lib/streak';

/**
 * Le cumul multi-actions d'un objectif, semaine par semaine — « combien de
 * km cette semaine, en tout » (voir CLAUDE.md, journal du 2026-09-06).
 *
 * De simples barres CSS, pas un SVG comme `PPChart` : ce widget vit dans la
 * carte d'un objectif, potentiellement plusieurs à l'écran à la fois, et n'a
 * besoin ni de survol ni de bascule tableau — juste le total et l'allure des
 * dernières semaines.
 *
 * Les dates (06/10/2026) : la première et la dernière semaine sous les
 * barres, et toucher une barre dit sa semaine et son total à la place de
 * « cette semaine » — l'infobulle `title` ne s'ouvre pas au doigt.
 */
const WEEKS_SHOWN = 12;

export function GoalAmountChart({
  summary,
  unit,
  onHide,
}: {
  summary: GoalAmountSummary;
  unit: string;
  /** Masquer ce cumul pour cet objectif — un choix explicite, réversible. */
  onHide: () => void;
}) {
  const recent = summary.weeks.slice(-WEEKS_SHOWN);
  const max = Math.max(...recent.map((w) => w.amount), 1);
  const last = recent[recent.length - 1];
  const [selected, setSelected] = useState<string | null>(null);
  const picked = recent.find((w) => w.monday === selected) ?? null;
  const today = dayString();

  return (
    <div className="goal-amount">
      <div className="goal-amount-head">
        <span className="goal-amount-total">{formatAmount(summary.total, unit)}</span>
        <span className="goal-amount-total-label">depuis le début</span>
        <button
          type="button"
          className="goal-amount-hide"
          title="Masquer ce cumul pour cet objectif"
          aria-label="Masquer ce cumul pour cet objectif"
          onClick={onHide}
        >
          ×
        </button>
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
            className={`goal-amount-bar-col${w.monday === selected ? ' is-active' : ''}`}
            onClick={() => setSelected((s) => (s === w.monday ? null : w.monday))}
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
      <div className="goal-amount-axis" aria-hidden="true">
        {recent.length > 1 && <span>sem. du {shortDay(recent[0].monday, today)}</span>}
        <span>cette semaine</span>
      </div>
      <div className="goal-amount-foot">
        {picked && picked !== last
          ? `${formatAmount(picked.amount, unit)} la semaine du ${shortDay(picked.monday, today)}`
          : `${formatAmount(last.amount, unit)} cette semaine`}
      </div>
    </div>
  );
}
