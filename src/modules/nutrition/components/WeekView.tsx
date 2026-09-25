import { shortDayLabel } from '../lib/day';
import { energyShares, targetKcal } from '../lib/macros';
import type { WeekSummary } from '../lib/week';

interface Props {
  summary: WeekSummary;
  today: string;
  /** Ouvre un jour dans la vue « Jour » */
  onOpenDay: (day: string) => void;
}

const W = 700;
const H = 220;
const TOP = 26;
const BOTTOM = 32;
const SIDE = 14;

const kcalText = (kcal: number) => kcal.toLocaleString('fr-FR');
const grams = (dg: number) => `${Math.round(dg / 10)} g`;

/**
 * La semaine en un coup d'œil (étape 7) : les kcal de chaque jour en barres,
 * l'objectif de chaque jour en pointillé, puis la moyenne des jours notés.
 *
 * Dessiné à la main en SVG, sans bibliothèque, comme les courbes de Zénith et
 * d'Astra — et sans rien leur emprunter (aucun import entre modules). Une
 * barre au-delà de l'objectif garde sa couleur (étude §8). Un jour sans rien
 * de noté n'a pas de barre : ce n'est pas un jour à 0 kcal.
 */
export function WeekView({ summary, today, onOpenDay }: Props) {
  const { days, average, loggedDays } = summary;
  const goals = days.map((d) => (d.target ? targetKcal(d.target) : null));
  const max = Math.max(1, ...days.map((d) => d.total.kcal), ...goals.map((g) => g ?? 0)) * 1.1;
  const slot = (W - SIDE * 2) / days.length;
  const barWidth = slot * 0.56;
  const y = (kcal: number) => H - BOTTOM - (kcal / max) * (H - TOP - BOTTOM);
  const endTarget = days[days.length - 1].target;
  const shares = average ? energyShares(average) : null;

  return (
    <section className="nutrition-week" aria-label="La semaine">
      <svg className="nutrition-week-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="kcal par jour sur la semaine">
        <line x1={SIDE} x2={W - SIDE} y1={H - BOTTOM} y2={H - BOTTOM} className="nutrition-week-axis" />
        {days.map((d, i) => {
          const cx = SIDE + slot * i + slot / 2;
          const goal = goals[i];
          return (
            <g
              key={d.day}
              className={`nutrition-week-day${d.day === today ? ' today' : ''}`}
              onClick={() => onOpenDay(d.day)}
            >
              <title>{`${shortDayLabel(d.day)} : ${d.logged ? `${kcalText(d.total.kcal)} kcal` : 'rien de noté'}`}</title>
              {/* Toute la colonne est cliquable, pas seulement la barre. */}
              <rect x={cx - slot / 2} y={0} width={slot} height={H} className="nutrition-week-hit" />
              {d.logged && (
                <rect
                  x={cx - barWidth / 2}
                  y={y(d.total.kcal)}
                  width={barWidth}
                  height={H - BOTTOM - y(d.total.kcal)}
                  rx={5}
                  className="nutrition-week-bar"
                />
              )}
              {goal !== null && (
                <line
                  x1={cx - slot * 0.42}
                  x2={cx + slot * 0.42}
                  y1={y(goal)}
                  y2={y(goal)}
                  className="nutrition-week-goal"
                />
              )}
              <text x={cx} y={d.logged ? y(d.total.kcal) - 7 : H - BOTTOM - 7} className="nutrition-week-value">
                {d.logged ? kcalText(d.total.kcal) : '—'}
              </text>
              <text x={cx} y={H - 10} className="nutrition-week-label">
                {shortDayLabel(d.day)}
              </text>
            </g>
          );
        })}
      </svg>
      {goals.some((g) => g !== null) && (
        <p className="nutrition-week-legend">
          <span className="nutrition-week-legend-goal" aria-hidden="true" /> objectif du jour
        </p>
      )}

      <div className="nutrition-week-average">
        {average ? (
          <>
            <h3 className="nutrition-results-title">
              Moyenne sur {loggedDays} jour{loggedDays > 1 ? 's' : ''} noté{loggedDays > 1 ? 's' : ''}
            </h3>
            <p className="nutrition-week-average-kcal">
              <b>{kcalText(average.kcal)}</b>
              {endTarget ? ` / ${kcalText(targetKcal(endTarget))} kcal` : ' kcal'} par jour
            </p>
            <p className="nutrition-week-average-macros">
              Protéines {grams(average.proteinDg)}
              {endTarget && ` / ${endTarget.proteinG} g`} · Glucides {grams(average.carbsDg)}
              {endTarget && ` / ${endTarget.carbsG} g`} · Lipides {grams(average.fatDg)}
              {endTarget && ` / ${endTarget.fatG} g`}
            </p>
            {shares && (
              <p className="nutrition-week-average-shares">
                Soit {shares.protein} % de l’énergie en protéines, {shares.carbs} % en glucides,{' '}
                {shares.fat} % en lipides.
              </p>
            )}
          </>
        ) : (
          <p className="nutrition-search-hint">Rien de noté sur ces sept jours.</p>
        )}
      </div>

      <ul className="nutrition-week-days">
        {days
          .slice()
          .reverse()
          .map((d) => (
            <li key={d.day}>
              <button type="button" className="nutrition-entry nutrition-week-row" onClick={() => onOpenDay(d.day)}>
                <span className="nutrition-entry-label">{shortDayLabel(d.day)}</span>
                <span className="nutrition-entry-grams">
                  {d.logged
                    ? `P ${grams(d.total.proteinDg)} · G ${grams(d.total.carbsDg)} · L ${grams(d.total.fatDg)}`
                    : 'rien de noté'}
                </span>
                <span className="nutrition-entry-kcal">{d.logged ? `${kcalText(d.total.kcal)} kcal` : '—'}</span>
              </button>
            </li>
          ))}
      </ul>
    </section>
  );
}
