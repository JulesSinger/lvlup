import { useEffect, useMemo, useRef, useState } from 'react';
import { centsToInputValue } from '../lib/amount';
import { monthLabel } from '../lib/month';
import type { TrendPoint } from '../lib/spendingTrend';

/**
 * L'évolution d'une dépense, mois par mois (onglet Évolution, demandé par
 * Jules le 06/09/2026). Même langage visuel que `objectifs/components/PPChart.tsx`
 * (barres, survol, bascule tableau) — pas le même code : un module n'importe
 * jamais depuis un autre.
 *
 * Une ligne pointillée marque la moyenne de la période affichée : elle
 * répond à la question que la courbe seule ne pose pas assez fort — « ce
 * mois-ci, par rapport à d'habitude ? » — sans jugement de valeur porté par
 * une couleur d'alerte, juste un repère.
 */

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

/** Une barre dont seul le bout haut est arrondi — le pied reste ancré à l'axe. */
function barPath(x: number, base: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return [
    `M${x},${base}`,
    `V${base - h + r}`,
    `Q${x},${base - h} ${x + r},${base - h}`,
    `H${x + w - r}`,
    `Q${x + w},${base - h} ${x + w},${base - h + r}`,
    `V${base}`,
    'Z',
  ].join(' ');
}

/** « juil. 26 » — assez court pour tenir sous une douzaine de barres. */
function shortLabel(monthKey: string): string {
  const full = monthLabel(monthKey); // « juillet 2026 »
  const [name, year] = full.split(' ');
  return `${name.slice(0, 4)}. ${year.slice(2)}`;
}

/**
 * Sans signe : cet écran ne montre que des dépenses, le rappeler sur
 * chaque montant (retour de Jules, 06/09/2026 : « pas besoin de mettre le
 * "-" partout, on sait que c'est des dépenses ») n'apprend rien.
 */
function formatSpent(cents: number): string {
  return `${centsToInputValue(cents)} €`;
}

/** Le montant directement sur la barre — arrondi à l'euro, pour tenir dans peu de place. */
function barLabel(cents: number): string {
  return `${Math.round(cents / 100).toLocaleString('fr-FR')} €`;
}

export function SpendingTrendChart({
  title,
  points,
  color,
}: {
  title: string;
  points: TrendPoint[];
  color: string;
}) {
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
        <h2 className="budget-chart-title">{title}</h2>
        <p className="budget-chart-empty">Rien à montrer avant ta première dépense.</p>
      </div>
    );
  }

  const maxCents = Math.max(...points.map((p) => p.cents), average, 1);
  const ticks = niceTicks(maxCents / 100).map((t) => t * 100); // niceTicks travaille en euros ronds
  const yMax = ticks[ticks.length - 1];
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const base = PAD.top + plotH;

  const slot = plotW / points.length;
  const barW = Math.max(3, Math.min(46, slot - GAP));
  const x = (i: number) => PAD.left + i * slot + (slot - barW) / 2;
  const hauteur = (cents: number) => (cents / yMax) * plotH;

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
        <h2 className="budget-chart-title">{title}</h2>
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
                <th scope="col">Dépensé</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.monthKey}>
                  <td>{monthLabel(p.monthKey)}</td>
                  <td>{formatSpent(p.cents)}</td>
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
            aria-label={`${title} : ${formatSpent(last.cents)} en ${monthLabel(last.monthKey)}, moyenne ${formatSpent(Math.round(average))} sur ${points.length} mois`}
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
                  y1={base - hauteur(t)}
                  y2={base - hauteur(t)}
                  stroke="#262e40"
                  strokeWidth="1"
                />
                <text x={PAD.left - 10} y={base - hauteur(t) + 4} className="budget-chart-tick" textAnchor="end">
                  {(t / 100).toLocaleString('fr-FR')}
                </text>
              </g>
            ))}

            {/* La moyenne de la période : un repère, pas un jugement. */}
            {average > 0 && (
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={base - hauteur(average)}
                y2={base - hauteur(average)}
                stroke="#6a748c"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            )}

            {points.map((p, i) =>
              p.cents > 0 ? (
                <path
                  key={p.monthKey}
                  d={barPath(x(i), base, barW, hauteur(p.cents))}
                  fill={color}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              ) : null,
            )}

            {/* Le montant directement au-dessus de chaque barre — sans lui,
                il fallait passer la souris dessus pour le lire (retour de
                Jules, 06/09/2026). Toujours affiché, même à zéro. */}
            {points.map((p, i) => (
              <text
                key={`label-${p.monthKey}`}
                x={x(i) + barW / 2}
                y={Math.max(PAD.top - 4, base - hauteur(p.cents) - 8)}
                className="budget-chart-bar-label"
                textAnchor="middle"
                opacity={hover === null || hover === i ? 1 : 0.55}
              >
                {barLabel(p.cents)}
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
                top: Math.max(8, base - hauteur(active.cents) - 46),
              }}
              role="status"
            >
              <strong>{formatSpent(active.cents)}</strong>
              <span>{monthLabel(active.monthKey)}</span>
            </div>
          )}
        </div>
      )}

      <p className="budget-chart-average">
        Moyenne sur {points.length} mois : {formatSpent(Math.round(average))}
      </p>
    </div>
  );
}
