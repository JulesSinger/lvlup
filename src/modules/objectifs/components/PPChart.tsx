import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDate, weeklyPP } from '../lib/progress';
import type { Checkin, Goal } from '../lib/types';

/**
 * Les PP gagnés semaine par semaine — une seule série, donc pas de légende :
 * le titre de la carte dit ce qui est tracé.
 *
 * Pourquoi des barres et non plus une courbe de cumul. Le cumul traçait le
 * nombre qu'on a retiré du profil pour son inutilité, et il le rendait même
 * plus difficile à lire : sur une courbe qui monte toujours, l'œil compare des
 * hauteurs, pas des inclinaisons, et deux mois à mi-régime ressemblent à « ça
 * monte encore ». Une barre courte, elle, se voit. Et la semaine est devenue
 * l'unité de l'app : le profil, la carte du hub et le prix d'un gel s'y
 * comptent déjà.
 *
 * Choix de couleur : #b9812a (l'or Zénith, pas dans sa version claire mais
 * dans le pas validé pour fond sombre — luminosité dans la bande 0,48–0,67 et
 * contraste ≥ 3:1 sur la surface). Les textes restent en gris de texte : la
 * couleur appartient aux marques, jamais aux libellés.
 */

const SERIES = '#b9812a';
const SURFACE = '#161b27';
const PAD = { top: 18, right: 24, bottom: 34, left: 50 };
const HEIGHT = 240;
/** Écart entre deux barres : la surface doit passer entre elles. */
const GAP = 2;

/**
 * Graduations rondes couvrant [0, max]. La dernière est toujours >= max :
 * sans cette garantie, la barre la plus haute sortait du cadre par le haut.
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

/**
 * Une barre dont seuls les bouts hauts sont arrondis.
 *
 * Un `<rect rx>` arrondit les quatre coins, y compris ceux posés sur l'axe :
 * la barre semble alors flotter au-dessus de sa ligne de base. Le bout côté
 * valeur s'arrondit, le pied reste ancré.
 */
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

/** « 18 mai » — l'année n'apparaît que si la semaine n'est pas de cette année. */
function labelSemaine(monday: string): string {
  return formatDate(`${monday}T12:00:00`);
}

export function PPChart({ goals, checkins }: { goals: Goal[]; checkins: Checkin[] }) {
  const weeks = useMemo(() => weeklyPP(goals, checkins), [goals, checkins]);
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

  if (weeks.length === 0) {
    return (
      <div className="chart-card">
        <h2 className="chart-title">PP par semaine</h2>
        <p className="chart-empty">
          Ton rythme apparaîtra ici dès ton premier check-in ou palier validé.
        </p>
      </div>
    );
  }

  const maxPP = Math.max(...weeks.map((w) => w.pp), 1);
  const ticks = niceTicks(maxPP);
  const yMax = ticks[ticks.length - 1];
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const base = PAD.top + plotH;

  const slot = plotW / weeks.length;
  const barW = Math.max(3, Math.min(46, slot - GAP));
  const x = (i: number) => PAD.left + i * slot + (slot - barW) / 2;
  const hauteur = (pp: number) => (pp / yMax) * plotH;

  const derniere = weeks[weeks.length - 1];
  const active = hover !== null ? weeks[hover] : null;
  const total = weeks.reduce((sum, w) => sum + w.pp, 0);

  function pointerToIndex(clientX: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = clientX - rect.left - PAD.left;
    return Math.max(0, Math.min(weeks.length - 1, Math.floor(px / slot)));
  }

  return (
    <div className="chart-card">
      <div className="chart-head">
        <h2 className="chart-title">PP par semaine</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowTable((v) => !v)}>
          {showTable ? 'Voir le graphe' : 'Voir le tableau'}
        </button>
      </div>

      {showTable ? (
        <div className="chart-table-wrap">
          <table className="chart-table">
            <thead>
              <tr>
                <th scope="col">Semaine du</th>
                <th scope="col">PP gagnés</th>
                <th scope="col">Paliers</th>
              </tr>
            </thead>
            <tbody>
              {[...weeks].reverse().map((w) => (
                <tr key={w.monday}>
                  <td>{labelSemaine(w.monday)}</td>
                  <td>{w.pp.toLocaleString('fr-FR')}</td>
                  <td>{w.tiers > 0 ? w.tiers : '—'}</td>
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
            aria-label={`PP par semaine : ${total} PP sur ${weeks.length} semaine${weeks.length > 1 ? 's' : ''}, ${derniere.pp} cette semaine`}
            tabIndex={0}
            onPointerMove={(e) => setHover(pointerToIndex(e.clientX))}
            onPointerLeave={() => setHover(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') setHover((h) => Math.min(weeks.length - 1, (h ?? -1) + 1));
              if (e.key === 'ArrowLeft') setHover((h) => Math.max(0, (h ?? weeks.length) - 1));
              if (e.key === 'Escape') setHover(null);
            }}
          >
            {/* Grille : hairlines pleines, une nuance au-dessus de la surface */}
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
                <text
                  x={PAD.left - 10}
                  y={base - hauteur(t) + 4}
                  className="chart-tick"
                  textAnchor="end"
                >
                  {t.toLocaleString('fr-FR')}
                </text>
              </g>
            ))}

            {/* Les barres. Bouts arrondis côté valeur, ancrés à la ligne de
                base : une semaine à zéro ne doit rien dessiner du tout, pas un
                moignon qui ressemblerait à un petit quelque chose. */}
            {weeks.map((w, i) =>
              w.pp > 0 ? (
                <path
                  key={w.monday}
                  d={barPath(x(i), base, barW, hauteur(w.pp))}
                  fill={SERIES}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              ) : null,
            )}

            {/* Jalons : les semaines où un palier a été validé. Le point est
                posé au-dessus de la barre, cerclé de la surface pour rester
                lisible même sur une barre haute. */}
            {weeks.map((w, i) =>
              w.tiers > 0 ? (
                <circle
                  key={`t-${w.monday}`}
                  cx={x(i) + barW / 2}
                  cy={base - hauteur(w.pp) - 9}
                  r="4"
                  fill={SERIES}
                  stroke={SURFACE}
                  strokeWidth="2"
                />
              ) : null,
            )}

            {/* Repères d'axe : la première et la dernière semaine. Une
                étiquette sous chaque barre se chevaucherait dès dix semaines. */}
            <text x={PAD.left} y={HEIGHT - 10} className="chart-tick" textAnchor="start">
              {labelSemaine(weeks[0].monday)}
            </text>
            {weeks.length > 1 && (
              <text
                x={width - PAD.right}
                y={HEIGHT - 10}
                className="chart-tick"
                textAnchor="end"
              >
                {labelSemaine(derniere.monday)}
              </text>
            )}
          </svg>

          {active && (
            <div
              className="chart-tooltip"
              style={{
                left: Math.min(Math.max(x(hover as number) + barW / 2, 70), width - 70),
                top: Math.max(8, base - hauteur(active.pp) - 46),
              }}
              role="status"
            >
              <strong>{active.pp.toLocaleString('fr-FR')} PP</strong>
              <span>
                semaine du {labelSemaine(active.monday)}
                {active.tiers > 0 && ` · ${active.tiers} palier${active.tiers > 1 ? 's' : ''}`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
