import { useEffect, useRef, useState } from 'react';

export interface TrendPoint {
  /** Sous l'axe (« 13 juil. », « nov. »). */
  label: string;
  /** Dit au survol ou au toucher : la tranche entière (« semaine du 13 juil. »). */
  title: string;
  value: number | null;
}

const HEIGHT = 150;
const PAD = { top: 12, right: 12, bottom: 22, left: 52 };

/**
 * Une courbe par tranches de temps régulières (docs/etude-sport.md §17).
 * `lowerIsBetter` (une allure, un temps) met le meilleur en HAUT : une courbe
 * qui monte est une progression, quelle que soit la grandeur. Une tranche sans
 * valeur laisse un trou dans les points, pas dans la ligne.
 *
 * Le SVG mesure sa vraie largeur plutôt que d'être étiré : le texte des axes
 * resterait déformé sinon (même choix que les courbes d'Objectifs).
 */
export function TrendChart({ points, format, lowerIsBetter = false, label }: {
  points: TrendPoint[];
  format: (v: number) => string;
  lowerIsBetter?: boolean;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const known = points.flatMap((p, i) => (p.value === null ? [] : [{ ...p, value: p.value, i }]));
  const values = known.map((p) => p.value);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const margin = (hi - lo) * 0.1;
  lo -= margin;
  hi += margin;
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length > 1 ? (i / (points.length - 1)) * plotW : plotW / 2);
  const share = (v: number) => (v - lo) / (hi - lo);
  const y = (v: number) => PAD.top + (lowerIsBetter ? share(v) : 1 - share(v)) * plotH;
  const best = lowerIsBetter ? Math.min(...values) : Math.max(...values);
  const worst = lowerIsBetter ? Math.max(...values) : Math.min(...values);
  const middle = Math.floor((points.length - 1) / 2);
  const shown = picked !== null ? points[picked] : null;

  return (
    <div className="sport-trend" ref={box}>
      {known.length === 0 ? null : (
        <svg width={width} height={HEIGHT} role="img" aria-label={`${label} : ${known.map((p) => `${p.title} ${format(p.value)}`).join(', ')}`}>
          <line x1={PAD.left} x2={width - PAD.right} y1={y(best)} y2={y(best)} stroke="var(--border)" strokeDasharray="3 4" />
          <line x1={PAD.left} x2={width - PAD.right} y1={y(worst)} y2={y(worst)} stroke="var(--border)" strokeDasharray="3 4" />
          <text x={PAD.left - 6} y={y(best) + 4} textAnchor="end" className="sport-trend-axis">
            {format(best)}
          </text>
          <text x={PAD.left - 6} y={y(worst) + 4} textAnchor="end" className="sport-trend-axis">
            {format(worst)}
          </text>
          {known.length > 1 && (
            <polyline
              points={known.map((p) => `${x(p.i)},${y(p.value)}`).join(' ')}
              fill="none"
              stroke="var(--red)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {known.map((p) => (
            <circle
              key={p.i}
              cx={x(p.i)}
              cy={y(p.value)}
              r={picked === p.i ? 5 : 3.5}
              fill={picked === p.i ? 'var(--red)' : 'var(--surface)'}
              stroke="var(--red)"
              strokeWidth={2}
              className="sport-trend-dot"
              onClick={() => setPicked(picked === p.i ? null : p.i)}
            >
              <title>{`${p.title} : ${format(p.value)}`}</title>
            </circle>
          ))}
          {[0, middle, points.length - 1]
            .filter((i, k, all) => all.indexOf(i) === k)
            .map((i) => (
              <text key={i} x={x(i)} y={HEIGHT - 6} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} className="sport-trend-axis">
                {points[i].label}
              </text>
            ))}
        </svg>
      )}
      {shown && shown.value !== null && (
        <p className="sport-trend-picked">
          {shown.title} : <b>{format(shown.value)}</b>
        </p>
      )}
    </div>
  );
}
