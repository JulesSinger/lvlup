import { useMemo } from 'react';
import { formatAmount } from '../lib/counters';
import { formatDate } from '../lib/progress';
import { measureSeries, measureTarget } from '../lib/quantities';
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
 */

const SERIES = '#b9812a';
const SURFACE = '#161b27';
const HEIGHT = 96;
const PAD = { top: 12, right: 12, bottom: 18, left: 12 };

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

  // Un seul point ne fait pas une tendance : on attend le deuxième relevé
  // plutôt que d'afficher une ligne horizontale qui ne dit rien.
  if (series.length < 2) return null;

  const width = 320;
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const values = series.map((p) => p.value);
  if (target !== null) values.push(target);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Amplitude nulle (tous les relevés identiques) : on ouvre une fenêtre
  // arbitraire pour ne pas diviser par zéro.
  const span = max - min || Math.abs(max) * 0.1 || 1;
  const lo = min - span * 0.15;
  const hi = max + span * 0.15;

  const x = (i: number) => PAD.left + (i / (series.length - 1)) * plotW;
  const y = (value: number) => PAD.top + plotH - ((value - lo) / (hi - lo)) * plotH;

  const line = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');
  const first = series[0];
  const last = series[series.length - 1];

  return (
    <div className="measure-chart">
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Suivi : ${formatAmount(first.value, tier.unit)} le ${formatDate(
          `${first.day}T12:00:00`,
        )}, ${formatAmount(last.value, tier.unit)} le ${formatDate(`${last.day}T12:00:00`)}`}
      >
        {/* Le point de départ : ce à quoi tout se compare. */}
        <line
          x1={PAD.left}
          x2={width - PAD.right}
          y1={y(first.value)}
          y2={y(first.value)}
          stroke="#2c3550"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
        {target !== null && (
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={y(target)}
            y2={y(target)}
            stroke="#3fb950"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.75"
          />
        )}

        <path
          d={line}
          fill="none"
          stroke={SERIES}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {series.map((p, i) => (
          <circle key={p.day} cx={x(i)} cy={y(p.value)} r={i === series.length - 1 ? 4 : 2.5} fill={SERIES} stroke={SURFACE} strokeWidth="1.5" />
        ))}
      </svg>

      {/* Rien d'autre que la légende des deux pointillés : la barre juste
          au-dessus dit déjà où on en est, le répéter serait du bruit. */}
      <div className="measure-foot">
        <span className="measure-legend base">départ {formatAmount(first.value, tier.unit)}</span>
        {target !== null && (
          <span className="measure-legend goal">cible {formatAmount(target, tier.unit)}</span>
        )}
      </div>
    </div>
  );
}
