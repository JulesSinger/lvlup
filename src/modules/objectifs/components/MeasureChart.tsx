import { useEffect, useMemo, useRef, useState } from 'react';
import { formatAmount } from '../lib/counters';
import { agoLabel, axisTicks, shortDay, spanLabel, timePositions } from '../lib/chartTime';
import { formatDate } from '../lib/progress';
import { actionMeasureSeries, measureSeries, measureTarget } from '../lib/quantities';
import type { Reading } from '../lib/quantities';
import { dayString } from '../lib/streak';
import type { Action, Checkin, Tier } from '../lib/types';

/**
 * La courbe d'une mesure — le poids, le tour de taille.
 *
 * Une barre de progression ne dit pas la même chose qu'une courbe : sur une
 * mesure, ce qui compte n'est pas « où j'en suis » mais **la pente**. Deux
 * kilos perdus puis repris se lisent d'un coup d'œil ici, et pas du tout dans
 * un compteur.
 *
 * Choix délibéré : pas d'axe zéro. Un poids tracé depuis 0 kg écrase toute la
 * variation en une ligne plate — la courbe cadre sur l'amplitude réelle des
 * relevés, cible comprise.
 *
 * `MeasureCurve` est le tracé nu, réutilisé à deux endroits qui n'ont pas la
 * même notion de cible : un palier de nature « mesure » (`MeasureChart`, une
 * cible chiffrée) et une action de nature relevé filtrée dans la grille
 * (`ActionMeasureChart`, dans `Heatmap.tsx` — juste l'historique, sans cible).
 *
 * Le temps (06/10/2026, demande de Jules : « on a les points mais pas les
 * dates ») : chaque relevé se place à SA date, pas à intervalles réguliers —
 * trois pesées en une semaine puis une deux mois plus tard ne se ressemblent
 * plus. Les dates s'écrivent sous l'axe, et toucher ou survoler un point dit
 * sa valeur, son jour et combien de temps a passé depuis.
 */

const SERIES = 'var(--accent-deep)';
const SURFACE = 'var(--surface)';
const HEIGHT = 120;
const PAD = { top: 12, right: 14, bottom: 30, left: 14 };
/** La place d'une date sous l'axe : « 12 déc. 2025 » tient en 70 px. */
const LABEL_SLOT = 78;

export function MeasureChart({
  tier,
  actions,
  checkins,
}: {
  tier: Tier;
  actions: Action[];
  checkins: Checkin[];
}) {
  const series = useMemo(() => measureSeries(tier, checkins, actions), [tier, checkins, actions]);
  const target = measureTarget(tier, series);
  return <MeasureCurve series={series} unit={tier.unit} target={target} />;
}

export function ActionMeasureChart({ action, checkins }: { action: Action; checkins: Checkin[] }) {
  const series = useMemo(() => actionMeasureSeries(action.id, checkins), [action.id, checkins]);
  return <MeasureCurve series={series} unit={action.unit} target={null} />;
}

export function MeasureCurve({
  series,
  unit,
  target,
}: {
  series: Reading[];
  unit: string;
  target: number | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [active, setActive] = useState<number | null>(null);
  const positions = useMemo(() => timePositions(series.map((p) => p.day)), [series]);
  const drawable = series.length >= 2;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [drawable]);

  // Un seul point ne fait pas une tendance : on attend le deuxième relevé
  // plutôt que d'afficher une ligne horizontale qui ne dit rien.
  if (!drawable) return null;

  const today = dayString();
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const base = PAD.top + plotH;

  const values = series.map((p) => p.value);
  if (target !== null) values.push(target);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Amplitude nulle (tous les relevés identiques) : on ouvre une fenêtre
  // arbitraire pour ne pas diviser par zéro.
  const span = max - min || Math.abs(max) * 0.1 || 1;
  const lo = min - span * 0.15;
  const hi = max + span * 0.15;

  const x = (i: number) => PAD.left + positions[i] * plotW;
  const y = (value: number) => PAD.top + plotH - ((value - lo) / (hi - lo)) * plotH;

  const line = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');
  const first = series[0];
  const last = series[series.length - 1];
  const ticks = axisTicks(
    series.map((p) => p.day),
    Math.max(2, Math.floor(plotW / LABEL_SLOT)),
  );
  const shown = active !== null ? series[active] : null;

  /** Le relevé le plus proche du doigt, dans le temps. */
  function nearest(clientX: number): number {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return series.length - 1;
    const px = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < series.length; i++) {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    }
    return best;
  }

  return (
    <div className="measure-chart">
      <div ref={wrapRef} className="measure-plot">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Suivi : ${formatAmount(first.value, unit)} le ${formatDate(
            `${first.day}T12:00:00`,
          )}, ${formatAmount(last.value, unit)} le ${formatDate(`${last.day}T12:00:00`)}`}
          tabIndex={0}
          onPointerMove={(e) => setActive(nearest(e.clientX))}
          onPointerDown={(e) => setActive(nearest(e.clientX))}
          onPointerLeave={(e) => {
            // Au doigt, le point reste affiché après le toucher.
            if (e.pointerType === 'mouse') setActive(null);
          }}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setActive((a) => Math.min(series.length - 1, (a ?? -1) + 1));
            if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? series.length) - 1));
            if (e.key === 'Escape') setActive(null);
          }}
        >
          {/* Les repères de temps : un trait discret par date écrite. */}
          {ticks.map((t) => (
            <line
              key={`g-${t.day}`}
              x1={PAD.left + t.at * plotW}
              x2={PAD.left + t.at * plotW}
              y1={PAD.top}
              y2={base}
              stroke="var(--border)"
              strokeWidth="1"
            />
          ))}

          {/* Le point de départ : ce à quoi tout se compare. */}
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={y(first.value)}
            y2={y(first.value)}
            stroke="var(--border-strong)"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          {target !== null && (
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(target)}
              y2={y(target)}
              stroke="var(--success)"
              strokeWidth="1"
              strokeDasharray="4 4"
              opacity="0.75"
            />
          )}

          {shown && (
            <line
              x1={x(active as number)}
              x2={x(active as number)}
              y1={PAD.top}
              y2={base}
              stroke="var(--border-strong)"
              strokeWidth="1"
            />
          )}

          <path
            d={line}
            fill="none"
            stroke={SERIES}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {series.map((p, i) => (
            <circle
              key={p.day}
              cx={x(i)}
              cy={y(p.value)}
              r={i === active ? 5 : i === series.length - 1 ? 4 : 2.5}
              fill={SERIES}
              stroke={SURFACE}
              strokeWidth="1.5"
            />
          ))}

          {ticks.map((t) => (
            <text
              key={`l-${t.day}`}
              className="chart-tick measure-tick"
              x={PAD.left + t.at * plotW}
              y={HEIGHT - 10}
              textAnchor={t.at === 0 ? 'start' : t.at === 1 ? 'end' : 'middle'}
            >
              {shortDay(t.day, today)}
            </text>
          ))}
        </svg>

        {shown && (
          <div
            className="chart-tooltip"
            style={{
              left: Math.min(Math.max(x(active as number), 70), width - 70),
              top: Math.max(4, y(shown.value) - 10),
            }}
            role="status"
          >
            <strong>{formatAmount(shown.value, unit)}</strong>
            <span>
              {shortDay(shown.day, today)} · {agoLabel(shown.day, today)}
            </span>
          </div>
        )}
      </div>

      {/* La légende des deux pointillés, et le temps couvert : la barre juste
          au-dessus dit déjà où on en est, le répéter serait du bruit. */}
      <div className="measure-foot">
        <span className="measure-legend base">départ {formatAmount(first.value, unit)}</span>
        {target !== null && (
          <span className="measure-legend goal">cible {formatAmount(target, unit)}</span>
        )}
        <span className="measure-span">
          {series.length} relevés {spanLabel(first.day, last.day)} · dernier {agoLabel(last.day, today)}
        </span>
      </div>
    </div>
  );
}
