import type { ReactNode } from 'react';
import { CATEGORY_INFO } from '../lib/categories';
import type { Feat, FeatPhoto } from '../lib/types';
import { PhotoImg } from './PhotoImg';

/**
 * La couverture d'un haut fait : sa première photo, en plein, le titre posé
 * sur un dégradé sombre. Sans photo, l'emblème de la catégorie en grand, sur
 * un fond teinté de sa couleur — une fiche sans photo ne doit pas paraître
 * vide (docs/etude-hauts-faits.md §4.2).
 */
export function FeatCover({
  feat,
  photo = null,
  large = false,
  children,
}: {
  feat: Feat;
  photo?: FeatPhoto | null;
  large?: boolean;
  children?: ReactNode;
}) {
  const info = CATEGORY_INFO[feat.category];
  return (
    <div
      className={`hautsfaits-cover${large ? ' large' : ''}${photo ? ' has-photo' : ''}`}
      style={{ '--hautsfaits-c': info.color } as React.CSSProperties}
    >
      {photo ? (
        // La couverture de la fiche prend la grande version, la miniature en attendant.
        <PhotoImg photo={photo} size={large ? 'full' : 'thumb'} fallback={large ? 'thumb' : undefined} alt="" className="hautsfaits-cover-photo" />
      ) : (
        <span className="hautsfaits-cover-emblem" aria-hidden="true">
          {info.emoji}
        </span>
      )}
      {feat.highlight && <span className="hautsfaits-medallion">{feat.highlight}</span>}
      {children}
    </div>
  );
}
