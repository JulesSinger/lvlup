import { useMemo } from 'react';
import { CATEGORY_INFO } from '../lib/categories';
import { formatFeatSpan } from '../lib/dates';
import { buildLifeWeeks, livedLabel, WEEKS_PER_ROW, type LifeHorizon } from '../lib/lifeWeeks';
import type { Feat } from '../lib/types';

const PITCH = 13;
const CELL = 10;
const GUTTER = 30;
const cx = (index: number) => GUTTER + (index % WEEKS_PER_ROW) * PITCH + CELL / 2;
const cy = (index: number) => Math.floor(index / WEEKS_PER_ROW) * PITCH + CELL / 2;

/** Le tracé d'un ensemble de cases, en un seul chemin : des milliers de cases restent légères. */
function cellsPath(from: number, to: number): string {
  let d = '';
  for (let i = from; i <= to; i++) {
    d += `M${GUTTER + (i % WEEKS_PER_ROW) * PITCH} ${Math.floor(i / WEEKS_PER_ROW) * PITCH}h${CELL}v${CELL}h-${CELL}z`;
  }
  return d;
}

/**
 * Une vie en semaines (docs/etude-hauts-faits.md §4.3) : une ligne par année
 * de vie, 52 cases par ligne. Les semaines vécues sont pleines, celle-ci
 * brille, les hauts faits sont des points de leur couleur, les périodes des
 * bandes. Jusqu'à aujourd'hui, ou jusqu'à 90 ans (décision du 29/09/2026).
 */
export function LifeWeeksView({
  feats,
  birthDate,
  today,
  horizon,
  onHorizon,
  onOpen,
  onAddBirthDate,
}: {
  feats: Feat[];
  birthDate: string | null;
  today: string;
  horizon: LifeHorizon;
  onHorizon: (h: LifeHorizon) => void;
  onOpen: (feat: Feat) => void;
  onAddBirthDate: () => void;
}) {
  const weeks = useMemo(() => buildLifeWeeks(feats, birthDate, today, horizon), [feats, birthDate, today, horizon]);
  const paths = useMemo(() => {
    if (!weeks) return null;
    return {
      lived: cellsPath(0, weeks.current - 1),
      future: cellsPath(weeks.current + 1, weeks.rows * WEEKS_PER_ROW - 1),
      now: cellsPath(weeks.current, weeks.current),
    };
  }, [weeks]);

  if (!weeks || !paths) {
    return (
      <section className="hautsfaits-weeks-empty">
        <p>
          Chaque case est une semaine, chaque ligne une année de ta vie. Pour la dessiner, il faut savoir quand elle a
          commencé.
        </p>
        <button className="btn btn-primary btn-sm" onClick={onAddBirthDate}>
          Ajouter ma date de naissance
        </button>
      </section>
    );
  }

  const width = GUTTER + WEEKS_PER_ROW * PITCH - (PITCH - CELL);
  const height = weeks.rows * PITCH - (PITCH - CELL);
  const ages = Array.from({ length: Math.floor((weeks.rows - 1) / 10) + 1 }, (_, i) => i * 10);

  return (
    <section className="hautsfaits-weeks">
      <div className="hautsfaits-weeks-head">
        <p className="hautsfaits-weeks-count">{livedLabel(weeks, horizon)}</p>
        <button className={`hautsfaits-chip${horizon === 'life' ? ' on' : ''}`} aria-pressed={horizon === 'life'} onClick={() => onHorizon(horizon === 'life' ? 'today' : 'life')}>
          Jusqu’à 90 ans
        </button>
      </div>
      <p className="hautsfaits-weeks-legend">Chaque case est une semaine, chaque ligne une année de ta vie. Touche un point pour ouvrir son haut fait.</p>
      <svg className="hautsfaits-weeks-grid" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Une vie en semaines : ${livedLabel(weeks, horizon)}`}>
        {ages.map((age) => (
          <text key={age} className="hautsfaits-weeks-age" x={GUTTER - 6} y={age * PITCH + CELL - 1} textAnchor="end">
            {age}
          </text>
        ))}
        <path className="hautsfaits-week-lived" d={paths.lived} />
        {paths.future && <path className="hautsfaits-week-future" d={paths.future} />}
        {weeks.bands.map((band) => (
          <path key={band.feat.id} className="hautsfaits-week-band" d={cellsPath(band.from, band.to)} style={{ fill: CATEGORY_INFO[band.feat.category].color }} />
        ))}
        <path className="hautsfaits-week-now" d={paths.now} />
        {weeks.dots.map((dot) => {
          const first = dot.feats[0];
          const label = dot.feats.map((f) => `${f.title}, ${formatFeatSpan(f)}`).join(' ; ');
          const open = () => onOpen(first);
          return (
            <g
              key={dot.index}
              className="hautsfaits-week-dot"
              role="button"
              tabIndex={0}
              aria-label={label}
              data-feat-dot={first.id}
              onClick={open}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  open();
                }
              }}
            >
              <title>{label}</title>
              {/* Une zone de toucher plus large que le point : sur téléphone, la grille est réduite de moitié. */}
              <circle className="hautsfaits-week-hit" cx={cx(dot.index)} cy={cy(dot.index)} r={12} />
              <circle className="hautsfaits-week-mark" cx={cx(dot.index)} cy={cy(dot.index)} r={first.major ? 7 : 5.5} style={{ fill: CATEGORY_INFO[first.category].color }} />
            </g>
          );
        })}
      </svg>
    </section>
  );
}
