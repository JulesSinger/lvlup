import { useEffect, useRef, useState } from 'react';
import { formatCents } from '../lib/amount';
import type { SavingsPoint } from '../lib/envelopes';

/**
 * Courbe d'évolution du total mis de côté (docs/etude-astra-epargne.md §6,
 * initialement écartée du chantier, demandée ensuite par Jules) — une seule
 * série, donc pas de légende : le titre de la carte dit ce qui est tracé.
 *
 * Construction volontairement propre à Astra plutôt que réutilisée depuis
 * `objectifs/components/PPChart.tsx`, qui trace la même forme de courbe
 * (points cumulés dans le temps) : un module n'importe jamais depuis un
 * autre (`conventions.test.ts`).
 */

const SERIES = '#6fbf7f';
const PAD = { top: 18, right: 16, bottom: 26, left: 64 };
const HEIGHT = 200;

/** Graduations rondes couvrant [0, max]. La dernière est toujours >= max. */
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

export function SavingsChart({ points }: { points: SavingsPoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(240, entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (points.length === 0) {
    return (
      <div className="budget-chart-card">
        <h2 className="budget-chart-title">Évolution du total mis de côté</h2>
        <p className="budget-chart-empty">
          La courbe apparaîtra dès ta première écriture catégorisée Épargne.
        </p>
      </div>
    );
  }

  const maxTotal = Math.max(...points.map((p) => p.totalCents), 0);
  const minTotal = Math.min(...points.map((p) => p.totalCents), 0);
  const ticks = niceTicks(maxTotal);
  const yMax = ticks[ticks.length - 1];
  // Le total peut être négatif (plus retiré que mis de côté) : le bas du
  // cadre suit, sans quoi la courbe sortirait par le bas.
  const yMin = Math.min(0, minTotal);
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const x = (i: number) =>
    points.length === 1 ? PAD.left + plotW / 2 : PAD.left + (i / (points.length - 1)) * plotW;
  const y = (value: number) => PAD.top + plotH - ((value - yMin) / (yMax - yMin)) * plotH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.totalCents)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const last = points[points.length - 1];
  const active = hover !== null ? points[hover] : null;

  function pointerToIndex(clientX: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || points.length === 0) return null;
    const px = clientX - rect.left;
    if (points.length === 1) return 0;
    const ratio = (px - PAD.left) / plotW;
    return Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1))));
  }

  return (
    <div className="budget-chart-card">
      <h2 className="budget-chart-title">Évolution du total mis de côté</h2>

      <div ref={wrapRef} className="budget-chart-wrap">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Évolution du total mis de côté : ${formatCents(last.totalCents).replace('+', '')} au ${last.day}`}
          tabIndex={0}
          onPointerMove={(e) => setHover(pointerToIndex(e.clientX))}
          onPointerLeave={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setHover((h) => Math.min(points.length - 1, (h ?? -1) + 1));
            if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? points.length) - 1));
            if (e.key === 'Escape') setHover(null);
          }}
        >
          <defs>
            <linearGradient id="budget-savings-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES} stopOpacity="0.18" />
              <stop offset="100%" stopColor={SERIES} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#262e40" strokeWidth="1" />
              <text x={PAD.left - 10} y={y(t) + 4} className="budget-chart-tick" textAnchor="end">
                {(t / 100).toLocaleString('fr-FR')} €
              </text>
            </g>
          ))}

          <text x={x(0)} y={HEIGHT - 8} className="budget-chart-tick" textAnchor="start">
            {points[0].day}
          </text>
          {points.length > 1 && (
            <text x={x(points.length - 1)} y={HEIGHT - 8} className="budget-chart-tick" textAnchor="end">
              {last.day}
            </text>
          )}

          <path d={area} fill="url(#budget-savings-area)" />
          <path d={line} fill="none" stroke={SERIES} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {active && (
            <g pointerEvents="none">
              <line
                x1={x(hover as number)}
                x2={x(hover as number)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke="#36405a"
                strokeWidth="1"
              />
              <circle cx={x(hover as number)} cy={y(active.totalCents)} r="5" fill={SERIES} stroke="#161b27" strokeWidth="2" />
            </g>
          )}

          <circle cx={x(points.length - 1)} cy={y(last.totalCents)} r="4.5" fill={SERIES} stroke="#161b27" strokeWidth="2" />
        </svg>

        {active && (
          <div
            className="budget-chart-tooltip"
            style={{ left: Math.min(Math.max(x(hover as number), 70), width - 70), top: y(active.totalCents) - 12 }}
            role="status"
          >
            <strong>{formatCents(active.totalCents).replace('+', '')}</strong>
            <span>{active.day}</span>
          </div>
        )}
      </div>
    </div>
  );
}
