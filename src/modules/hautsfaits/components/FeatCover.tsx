import type { ReactNode } from 'react';
import { CATEGORY_INFO } from '../lib/categories';
import type { Feat } from '../lib/types';

/**
 * La couverture d'un haut fait. En attendant les photos (étape 4), l'emblème
 * de la catégorie en grand, sur un fond teinté de sa couleur : une fiche sans
 * photo ne doit pas paraître vide (docs/etude-hauts-faits.md §4.2).
 */
export function FeatCover({ feat, large = false, children }: { feat: Feat; large?: boolean; children?: ReactNode }) {
  const info = CATEGORY_INFO[feat.category];
  return (
    <div
      className={`hautsfaits-cover${large ? ' large' : ''}`}
      style={{ '--hautsfaits-c': info.color } as React.CSSProperties}
    >
      <span className="hautsfaits-cover-emblem" aria-hidden="true">
        {info.emoji}
      </span>
      {feat.highlight && <span className="hautsfaits-medallion">{feat.highlight}</span>}
      {children}
    </div>
  );
}
