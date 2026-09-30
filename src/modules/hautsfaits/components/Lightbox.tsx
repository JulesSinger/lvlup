import { useEffect, useRef, useState } from 'react';
import type { FeatPhoto } from '../lib/types';
import { PhotoImg } from './PhotoImg';

/**
 * La visionneuse : une photo en plein écran, sur du noir dans les deux
 * thèmes. Glisser, les flèches du clavier ou les boutons passent d'une photo
 * à l'autre ; Échap, la croix ou glisser vers le bas ferment.
 */
export function Lightbox({ photos, start, title, onClose }: { photos: FeatPhoto[]; start: number; title: string; onClose: () => void }) {
  const [index, setIndex] = useState(Math.min(start, photos.length - 1));
  const touch = useRef<{ x: number; y: number } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = photos.length;
  const go = (step: number) => setIndex((i) => (i + step + count) % count);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // En capture : Échap ferme la visionneuse, pas la fiche qui est dessous.
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, count]);

  if (count === 0) return null;
  const photo = photos[index];

  return (
    <div
      className="hautsfaits-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Photos de « ${title} »`}
      onPointerDown={(e) => (touch.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        const from = touch.current;
        touch.current = null;
        if (!from) return;
        const dx = e.clientX - from.x;
        const dy = e.clientY - from.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose();
      }}
    >
      <PhotoImg key={photo.id} photo={photo} size="full" fallback="thumb" alt={`${title}, photo ${index + 1}`} className="hautsfaits-lightbox-img" />
      <button ref={closeRef} className="hautsfaits-lightbox-btn close" onClick={onClose} aria-label="Fermer la photo">
        ✕
      </button>
      {count > 1 && (
        <>
          <button className="hautsfaits-lightbox-btn prev" onClick={() => go(-1)} aria-label="Photo précédente">
            ‹
          </button>
          <button className="hautsfaits-lightbox-btn next" onClick={() => go(1)} aria-label="Photo suivante">
            ›
          </button>
          <span className="hautsfaits-lightbox-count" aria-live="polite">
            {index + 1} / {count}
          </span>
        </>
      )}
    </div>
  );
}
