import { useMemo } from 'react';
import { CATEGORY_INFO } from '../lib/categories';
import { formatFeatDate } from '../lib/dates';
import { buildShowcase } from '../lib/showcase';
import type { Feat, FeatPhoto } from '../lib/types';
import { PhotoImg } from './PhotoImg';

/**
 * La vitrine (docs/etude-hauts-faits.md §4.5) : un médaillon par haut fait,
 * rangés par catégorie, comme une salle des trophées. Les grands hauts faits
 * ont un anneau doré.
 */
export function Showcase({ feats, photos, onOpen }: { feats: Feat[]; photos: Map<string, FeatPhoto[]>; onOpen: (feat: Feat) => void }) {
  const shelves = useMemo(() => buildShowcase(feats), [feats]);
  return (
    <div className="hautsfaits-showcase">
      {shelves.map((shelf) => {
        const info = CATEGORY_INFO[shelf.category];
        return (
          <section key={shelf.category} className="hautsfaits-shelf" style={{ '--hautsfaits-c': info.color } as React.CSSProperties}>
            <h2 className="hautsfaits-shelf-title">
              <span aria-hidden="true">{info.emoji}</span> {info.label} <small>{shelf.feats.length}</small>
            </h2>
            <div className="hautsfaits-medals">
              {shelf.feats.map((feat) => {
                const cover = photos.get(feat.id)?.[0] ?? null;
                return (
                  <button key={feat.id} className={`hautsfaits-medal${feat.major ? ' major' : ''}`} onClick={() => onOpen(feat)}>
                    <span className="hautsfaits-medal-disc" aria-hidden="true">
                      {cover ? <PhotoImg photo={cover} size="thumb" alt="" /> : info.emoji}
                    </span>
                    <span className="hautsfaits-medal-title">{feat.title}</span>
                    <span className="hautsfaits-medal-when">{feat.highlight || formatFeatDate(feat.dateStart, feat.datePrecision)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
