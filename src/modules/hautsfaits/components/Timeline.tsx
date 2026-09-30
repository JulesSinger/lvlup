import { useEffect, useRef } from 'react';
import { ageAtFeat, ageLabel } from '../lib/age';
import { CATEGORY_INFO } from '../lib/categories';
import { durationLabel, formatFeatSpan } from '../lib/dates';
import { gapLabel, type TimelineRow } from '../lib/timeline';
import type { Feat, FeatPhoto } from '../lib/types';
import { FeatCover } from './FeatCover';
import { PhotoImg } from './PhotoImg';

/**
 * La frise (docs/etude-hauts-faits.md §4.1). Elle ne fait que dessiner les
 * lignes de `buildTimeline` : les années en grand avec l'âge, les grands
 * hauts faits en cartes, les autres en lignes compactes, et les années vides
 * resserrées. Sur ordinateur, les hauts faits s'alternent de part et
 * d'autre de l'axe ; sur téléphone, une seule colonne.
 */
export function Timeline({
  rows,
  photos,
  birthDate,
  justAdded,
  onOpen,
}: {
  rows: TimelineRow[];
  /** Les photos de chaque haut fait, dans leur ordre (la première fait la couverture). */
  photos: Map<string, FeatPhoto[]>;
  birthDate: string | null;
  /** Le haut fait tout juste gravé : il se pose avec un éclat (la cérémonie, §4.7). */
  justAdded: string | null;
  onOpen: (feat: Feat) => void;
}) {
  const ref = useReveal(rows);
  let side = 0;

  return (
    <ol className="hautsfaits-timeline" ref={ref}>
      {rows.map((row) => {
        if (row.kind === 'year') {
          return (
            <li key={`y${row.year}`} className="hautsfaits-year">
              <span className="hautsfaits-year-label">
                {row.year}
                {row.age !== null && <small> · {row.age} ans</small>}
              </span>
            </li>
          );
        }
        if (row.kind === 'gap') {
          return (
            <li key={`g${row.from}`} className="hautsfaits-gap" aria-label={`Rien en ${gapLabel(row)}`}>
              <span>{gapLabel(row)}</span>
            </li>
          );
        }
        const feat = row.feat;
        const info = CATEGORY_INFO[feat.category];
        const featPhotos = photos.get(feat.id) ?? [];
        const cover = featPhotos[0] ?? null;
        const age = ageAtFeat(birthDate, feat.dateStart, feat.datePrecision);
        const duration = durationLabel(feat);
        const when = [formatFeatSpan(feat), duration, age && ageLabel(age, feat.datePrecision)].filter(Boolean).join(' · ');
        const classes = ['hautsfaits-item', side++ % 2 ? 'right' : 'left', feat.id === justAdded ? 'new' : ''].filter(Boolean).join(' ');
        return (
          <li key={feat.id} className={classes} data-feat={feat.id} style={{ '--hautsfaits-c': info.color } as React.CSSProperties}>
            {feat.major ? (
              <button className="hautsfaits-card" onClick={() => onOpen(feat)}>
                <FeatCover feat={feat} photo={cover}>
                  <span className="hautsfaits-cover-title">{feat.title}</span>
                </FeatCover>
                <span className="hautsfaits-card-foot">
                  <span className="hautsfaits-dot" aria-hidden="true" />
                  <span className="hautsfaits-card-when">{when}</span>
                  {featPhotos.length > 1 && <span className="hautsfaits-card-count">{featPhotos.length} photos</span>}
                </span>
              </button>
            ) : (
              <button className="hautsfaits-line" onClick={() => onOpen(feat)}>
                <span className={`hautsfaits-badge${cover ? ' has-photo' : ''}`} aria-hidden="true">
                  {cover ? <PhotoImg photo={cover} size="thumb" alt="" /> : info.emoji}
                </span>
                <span className="hautsfaits-line-text">
                  <span className="hautsfaits-line-title">{feat.title}</span>
                  <span className="hautsfaits-line-when">{when}</span>
                </span>
                {feat.highlight && <span className="hautsfaits-line-highlight">{feat.highlight}</span>}
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Les hauts faits sous le bord de l'écran apparaissent en douceur quand on
 * les atteint. Ceux déjà visibles ne bougent pas : la frise est complète au
 * repos, l'animation n'est qu'un plus (et rien avec `prefers-reduced-motion`,
 * voir la feuille de style).
 */
function useReveal(rows: TimelineRow[]) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -40px 0px' },
    );
    // Tout ce qui n'est pas encore apparu est réexaminé à chaque rendu : un
    // observateur débranché ne doit jamais laisser un haut fait invisible.
    for (const item of root.querySelectorAll<HTMLElement>('.hautsfaits-item:not(.revealed)')) {
      if (item.getBoundingClientRect().top > window.innerHeight) {
        item.classList.add('waiting');
        observer.observe(item);
      } else {
        item.classList.remove('waiting');
      }
    }
    return () => observer.disconnect();
  }, [rows]);
  return ref;
}
