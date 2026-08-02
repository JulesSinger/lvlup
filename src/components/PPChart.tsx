import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDate, ppTimeline } from '../lib/progress';
import type { Checkin, Goal } from '../lib/types';

/**
 * Courbe des PP cumulés dans le temps — une seule série, donc pas de légende :
 * le titre de la carte dit ce qui est tracé.
 *
 * Choix de couleur : #b9812a (l'or Zénith, pas dans sa version claire mais
 * dans le pas validé pour fond sombre — luminosité dans la bande 0,48–0,67 et
 * contraste ≥ 3:1 sur la surface). Les textes restent en gris de texte : la
 * couleur appartient aux marques, jamais aux libellés.
 */

const SERIES = '#b9812a';
const SURFACE = '#161b27';
const PAD = { top: 18, right: 58, bottom: 30, left: 50 };
const HEIGHT = 240;

/**
 * Graduations rondes couvrant [0, max]. La dernière est toujours >= max :
 * sans cette garantie, le point le plus haut sortait du cadre par le haut.
 */
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

export function PPChart({ goals, checkins }: { goals: Goal[]; checkins: Checkin[] }) {
  const points = useMemo(() => ppTimeline(goals, checkins), [goals, checkins]);
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

  if (points.length === 0) {
    return (
      <div className="chart-card">
        <h2 className="chart-title">Progression des PP</h2>
        <p className="chart-empty">
          Ta courbe apparaîtra dès ton premier check-in ou palier validé.
        </p>
      </div>
    );
  }

  const maxTotal = points[points.length - 1].total;
  const ticks = niceTicks(maxTotal);
  const yMax = ticks[ticks.length - 1];
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  // Un seul point : on le place au centre plutôt que collé au bord gauche.
  const x = (i: number) =>
    points.length === 1 ? PAD.left + plotW / 2 : PAD.left + (i / (points.length - 1)) * plotW;
  const y = (value: number) => PAD.top + plotH - (value / yMax) * plotH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.total)}`).join(' ');
  const area = `${line} L${x(points.length - 1)},${PAD.top + plotH} L${x(0)},${PAD.top + plotH} Z`;
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
    <div className="chart-card">
      <div className="chart-head">
        <h2 className="chart-title">Progression des PP</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Voir la courbe' : 'Voir le tableau'}
        </button>
      </div>

      {showTable ? (
        <div className="chart-table-wrap">
          <table className="chart-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">PP gagnés</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.day}>
                  <td>{formatDate(`${p.day}T12:00:00`)}</td>
                  <td>+{p.gained}</td>
                  <td>{p.total.toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={wrapRef} className="chart-wrap">
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Progression des PP : ${maxTotal} PP cumulés sur ${points.length} jours d'activité`}
            tabIndex={0}
            onPointerMove={(e) => setHover(pointerToIndex(e.clientX))}
            onPointerLeave={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight')
                setHover((h) => Math.min(points.length - 1, (h ?? -1) + 1));
              if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? points.length) - 1));
              if (e.key === 'Escape') setHover(null);
            }}
          >
            <defs>
              <linearGradient id="pp-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES} stopOpacity="0.18" />
                <stop offset="100%" stopColor={SERIES} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Grille : hairlines pleines, une nuance au-dessus de la surface */}
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="#262e40"
                  strokeWidth="1"
                />
                <text x={PAD.left - 10} y={y(t) + 4} className="chart-tick" textAnchor="end">
                  {t.toLocaleString('fr-FR')}
                </text>
              </g>
            ))}

            {/* Premier et dernier jour en repères d'axe */}
            <text x={x(0)} y={HEIGHT - 10} className="chart-tick" textAnchor="start">
              {formatDate(`${points[0].day}T12:00:00`)}
            </text>
            {points.length > 1 && (
              <text
                x={x(points.length - 1)}
                y={HEIGHT - 10}
                className="chart-tick"
                textAnchor="end"
              >
                {formatDate(`${last.day}T12:00:00`)}
              </text>
            )}

            <path d={area} fill="url(#pp-area)" />
            <path
              d={line}
              fill="none"
              stroke={SERIES}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Jalons : les jours où un palier a été validé */}
            {points.map((p, i) =>
              p.tiers > 0 ? (
                <circle
                  key={p.day}
                  cx={x(i)}
                  cy={y(p.total)}
                  r="4"
                  fill={SERIES}
                  stroke={SURFACE}
                  strokeWidth="2"
                />
              ) : null,
            )}

            {/* Croix de survol */}
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
                <circle
                  cx={x(hover as number)}
                  cy={y(active.total)}
                  r="5"
                  fill={SERIES}
                  stroke={SURFACE}
                  strokeWidth="2"
                />
              </g>
            )}

            {/* Étiquette directe : uniquement le point final */}
            <circle
              cx={x(points.length - 1)}
              cy={y(last.total)}
              r="4.5"
              fill={SERIES}
              stroke={SURFACE}
              strokeWidth="2"
            />
            <text
              x={x(points.length - 1) + 10}
              y={y(last.total) + 4}
              className="chart-endlabel"
              textAnchor="start"
            >
              {last.total.toLocaleString('fr-FR')}
            </text>
          </svg>

          {active && (
            <div
              className="chart-tooltip"
              style={{
                left: Math.min(Math.max(x(hover as number), 70), width - 70),
                top: y(active.total) - 12,
              }}
              role="status"
            >
              <strong>{active.total.toLocaleString('fr-FR')} PP</strong>
              <span>
                {formatDate(`${active.day}T12:00:00`)} · +{active.gained}
                {active.tiers > 0 && ` · ${active.tiers} palier${active.tiers > 1 ? 's' : ''}`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
