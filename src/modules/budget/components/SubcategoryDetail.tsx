import { formatCents } from '../lib/amount';
import type { SubcategorySlice } from '../lib/monthlyBreakdown';

/**
 * Le détail d'une catégorie qui a des sous-catégories (« Loisirs » →
 * « Cartes One Piece », « Cinéma »), juste au-dessus de la liste des
 * écritures déjà filtrée sur elle — l'option choisie après comparaison de
 * trois maquettes (voir CLAUDE.md, journal) : rien de nouveau à naviguer,
 * une info en plus au même endroit. Le camembert, lui, continue de
 * n'afficher qu'une seule part pour la catégorie entière.
 */
export function SubcategoryDetail({
  title,
  slices,
  variant = 'expense',
}: {
  /** Le nom de la catégorie sélectionnée, ex. « Loisirs ». */
  title: string;
  slices: SubcategorySlice[];
  variant?: 'expense' | 'income';
}) {
  if (slices.length === 0) return null;
  const totalCents = slices.reduce((sum, s) => sum + s.cents, 0);
  const maxCents = Math.max(...slices.map((s) => s.cents), 1);
  const isIncome = variant === 'income';

  return (
    <div className="budget-subdetail">
      <p className="budget-subdetail-title">
        Détail de {title} — {formatCents(isIncome ? totalCents : -totalCents)}
      </p>
      {slices.map((s) => (
        <div key={s.categoryId ?? '__unspecified__'} className="budget-subdetail-row">
          <span className="budget-subdetail-name">
            <span aria-hidden="true">{s.emoji}</span> {s.label}
          </span>
          <span className="budget-subdetail-track">
            <span
              className="budget-subdetail-fill"
              style={{ width: `${(s.cents / maxCents) * 100}%`, background: s.color }}
            />
          </span>
          <span className="budget-subdetail-amount">{formatCents(isIncome ? s.cents : -s.cents)}</span>
        </div>
      ))}
    </div>
  );
}
