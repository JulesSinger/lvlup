import { formatCents } from '../lib/amount';
import type { BudgetSlice } from '../lib/monthlyBreakdown';

interface Props {
  slices: BudgetSlice[];
  totalCents: number;
  /** `undefined` = aucun filtre actif. */
  selectedCategoryId: string | null | undefined;
  onSelect: (categoryId: string | null) => void;
}

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 4;

function arcPoint(angleRadians: number): [number, number] {
  return [CENTER + RADIUS * Math.sin(angleRadians), CENTER - RADIUS * Math.cos(angleRadians)];
}

/**
 * Le camembert du mois (docs/etude-astra.md §5). Pas de librairie de
 * graphique dans Atlas — `objectifs/components/PPChart.tsx` fait le même
 * choix pour sa courbe — quelques chemins SVG suffisent pour des parts.
 */
export function PieChart({ slices, totalCents, selectedCategoryId, onSelect }: Props) {
  if (totalCents <= 0 || slices.length === 0) {
    return (
      <div className="budget-pie-empty" role="img" aria-label="Aucune dépense à répartir ce mois-ci">
        Rien à afficher
      </div>
    );
  }

  let cursor = 0;
  const arcs = slices.map((slice) => {
    const fraction = slice.cents / totalCents;
    const startAngle = cursor * 2 * Math.PI;
    cursor += fraction;
    const endAngle = cursor * 2 * Math.PI;
    const isFullCircle = fraction >= 0.99999;
    let d: string;
    if (isFullCircle) {
      d = `M ${CENTER} ${CENTER - RADIUS} A ${RADIUS} ${RADIUS} 0 1 1 ${CENTER - 0.01} ${CENTER - RADIUS} Z`;
    } else {
      const [x1, y1] = arcPoint(startAngle);
      const [x2, y2] = arcPoint(endAngle);
      const largeArc = fraction > 0.5 ? 1 : 0;
      d = `M ${CENTER} ${CENTER} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    }
    return { slice, d };
  });

  return (
    <div className="budget-pie-wrap">
      <svg
        className="budget-pie"
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Répartition du mois, total dépensé ${formatCents(-totalCents)}`}
      >
        {arcs.map(({ slice, d }) => (
          <path
            key={slice.categoryId ?? '__uncategorized__'}
            d={d}
            fill={slice.color}
            className={`budget-pie-slice${selectedCategoryId === slice.categoryId ? ' selected' : ''}`}
            onClick={() => onSelect(slice.categoryId)}
          />
        ))}
      </svg>
      <ul className="budget-pie-legend">
        {slices.map((slice) => (
          <li key={slice.categoryId ?? '__uncategorized__'}>
            <button
              type="button"
              className={`budget-pie-legend-item${selectedCategoryId === slice.categoryId ? ' selected' : ''}`}
              onClick={() => onSelect(slice.categoryId)}
            >
              <span className="budget-row-swatch" style={{ background: slice.color }} aria-hidden="true">
                {slice.emoji}
              </span>
              <span className="budget-pie-legend-label">{slice.label}</span>
              <span className="budget-pie-legend-amount">{formatCents(-slice.cents)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
