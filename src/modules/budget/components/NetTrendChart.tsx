import { useEffect, useMemo, useRef, useState } from 'react';
import { formatCents } from '../lib/amount';
import { monthLabel } from '../lib/month';
import type { NetPoint } from '../lib/spendingTrend';

/**
 * Le différentiel mensuel — entré moins dépensé (demandé par Jules le
 * 07/09/2026 : « de combien je suis en négatif ou positif chaque mois, pour
 * comparer »). Contrairement à `SpendingTrendChart`, la valeur peut être
 * négative : les barres partent d'une ligne zéro au milieu du cadre, vers
 * le haut pour un mois excédentaire, vers le bas pour un mois déficitaire —
 * mêmes teintes que le « Solde » de l'onglet Aperçu, jamais un rouge
 * d'alerte plus appuyé que le vert d'en face.
 */

const POSITIVE = '#6fbf7f';
const NEGATIVE = '#ff8b8b';
const PAD = { top: 18, right: 16, bottom: 34, left: 56 };
const HEIGHT = 220;
const GAP = 3;

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? magnitude * 10;
  const ticks: number[] = [];
  for (let v = 0; ; v += step) {
    ticks.push(Math.round(v));
    if (v >= max) break;
  }
  return ticks;
}

/** « juil. 26 » — assez court pour tenir sous une douzaine de barres. */
function shortLabel(monthKey: string): string {
  const full = monthLabel(monthKey);
  const [name, year] = full.split(' ');
  return `${name.slice(0, 4)}. ${year.slice(2)}`;
}

export function NetTrendChart({ points }: { points: NetPoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(280, entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const average = useMemo(
    () => (points.length === 0 ? 0 : points.reduce((sum, p) => sum + p.cents, 0) / points.length),
    [points],
  );

  if (points.length === 0) {
    return (
      <div className="budget-chart-card">
        <h2 className="budget-chart-title">Différentiel mensuel</h2>
        <p className="budget-chart-empty">Rien à montrer avant ta première écriture.</p>
      </div>
    );
  }

  const maxAbsCents = Math.max(...points.map((p) => Math.abs(p.cents)), 1);
  const posTicks = niceTicks(maxAbsCents / 100).map((t) => t * 100);
  const yMax = posTicks[posTicks.length - 1];
  const ticks = [...posTicks.filter((t) => t > 0).map((t) => -t).reverse(), ...posTicks];

  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const zeroY = PAD.top + plotH / 2;
  const halfH = plotH / 2;
  const barHeight = (cents: number) => (Math.abs(cents) / yMax) * halfH;
  const tickY = (t: number) => zeroY - (t / yMax) * halfH;

  const slot = plotW / points.length;
  const barW = Math.max(3, Math.min(46, slot - GAP));
  const x = (i: number) => PAD.left + i * slot + (slot - barW) / 2;

  const last = points[points.length - 1];
  const active = hover !== null ? points[hover] : null;

  function pointerToIndex(clientX: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = clientX - rect.left - PAD.left;
    return Math.max(0, Math.min(points.length - 1, Math.floor(px / slot)));
  }

  return (
    <div className="budget-chart-card">
      <div className="budget-chart-head">
        <h2 className="budget-chart-title">Différentiel mensuel</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Voir le graphe' : 'Voir le tableau'}
        </button>
      </div>

      {showTable ? (
        <div className="budget-chart-table-wrap">
          <table className="budget-chart-table">
            <thead>
              <tr>
                <th scope="col">Mois</th>
                <th scope="col">Différentiel</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.monthKey}>
                  <td>{monthLabel(p.monthKey)}</td>
                  <td className={p.cents < 0 ? 'negative' : p.cents > 0 ? 'positive' : ''}>
                    {formatCents(p.cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrapRef} className="budget-chart-wrap">
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Différentiel mensuel : ${formatCents(last.cents)} en ${monthLabel(last.monthKey)}, moyenne ${formatCents(Math.round(average))} sur ${points.length} mois`}
            tabIndex={0}
            onPointerMove={(e) => setHover(pointerToIndex(e.clientX))}
            onPointerLeave={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') setHover((h) => Math.min(points.length - 1, (h ?? -1) + 1));
              if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? points.length) - 1));
              if (e.key === 'Escape') setHover(null);
            }}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={tickY(t)}
                  y2={tickY(t)}
                  stroke={t === 0 ? '#36405a' : '#262e40'}
                  strokeWidth="1"
                />
                <text x={PAD.left - 10} y={tickY(t) + 4} className="budget-chart-tick" textAnchor="end">
                  {(t / 100).toLocaleString('fr-FR')}
                </text>
              </g>
            ))}

            {points.map((p, i) => {
              const h = barHeight(p.cents);
              if (h === 0) return null;
              const y = p.cents > 0 ? zeroY - h : zeroY;
              return (
                <rect
                  key={p.monthKey}
                  x={x(i)}
                  y={y}
                  width={barW}
                  height={h}
                  rx={2}
                  fill={p.cents > 0 ? POSITIVE : NEGATIVE}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              );
            })}

            {points.map((p, i) => (
              <text
                key={`label-${p.monthKey}`}
                x={x(i) + barW / 2}
                y={p.cents >= 0 ? zeroY - barHeight(p.cents) - 8 : zeroY + barHeight(p.cents) + 16}
                className="budget-chart-bar-label"
                textAnchor="middle"
                opacity={hover === null || hover === i ? 1 : 0.55}
              >
                {formatCents(p.cents)}
              </text>
            ))}

            <text x={PAD.left} y={HEIGHT - 10} className="budget-chart-tick" textAnchor="start">
              {shortLabel(points[0].monthKey)}
            </text>
            {points.length > 1 && (
              <text x={width - PAD.right} y={HEIGHT - 10} className="budget-chart-tick" textAnchor="end">
                {shortLabel(last.monthKey)}
              </text>
            )}
          </svg>

          {active && (
            <div
              className="budget-chart-tooltip"
              style={{
                left: Math.min(Math.max(x(hover as number) + barW / 2, 70), width - 70),
                top: Math.max(8, (active.cents >= 0 ? zeroY - barHeight(active.cents) : zeroY) - 46),
              }}
              role="status"
            >
              <strong>{formatCents(active.cents)}</strong>
              <span>{monthLabel(active.monthKey)}</span>
            </div>
          )}
        </div>
      )}

      <p className="budget-chart-average">
        Moyenne sur {points.length} mois : {formatCents(Math.round(average))}
      </p>
    </div>
  );
}
