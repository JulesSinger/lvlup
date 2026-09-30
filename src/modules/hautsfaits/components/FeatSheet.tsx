import { useEffect, useRef, useState } from 'react';
import { ageAtFeat, ageLabel, sinceLabel } from '../lib/age';
import { CATEGORY_INFO } from '../lib/categories';
import { durationLabel, formatFeatSpan } from '../lib/dates';
import type { Feat, FeatPhoto } from '../lib/types';
import { FeatCover } from './FeatCover';
import { PhotoGallery } from './PhotoGallery';

/**
 * La fiche d'un haut fait, en grand : une page de souvenir plutôt qu'un
 * formulaire (docs/etude-hauts-faits.md §4.2). La couverture, le titre, le
 * temps écoulé et l'âge qu'on avait, puis le reste, et la galerie de ses
 * photos (étape 4) : la première fait la couverture.
 */
export function FeatSheet({
  feat,
  photos,
  uploading,
  birthDate,
  today,
  onAddPhotos,
  onMakeCover,
  onRemovePhoto,
  onEdit,
  onDelete,
  onClose,
  onAddBirthDate,
}: {
  feat: Feat;
  photos: FeatPhoto[];
  /** Des photos partent : on n'en ajoute pas d'autres en même temps. */
  uploading: boolean;
  birthDate: string | null;
  today: string;
  onAddPhotos: (files: File[]) => void;
  onMakeCover: (photo: FeatPhoto) => void;
  onRemovePhoto: (photo: FeatPhoto) => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onClose: () => void;
  onAddBirthDate: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const info = CATEGORY_INFO[feat.category];
  const age = ageAtFeat(birthDate, feat.dateStart, feat.datePrecision);
  const duration = durationLabel(feat);
  const since = sinceLabel(feat.dateStart, feat.datePrecision, today);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function remove() {
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay hautsfaits-sheet-overlay" onClick={onClose}>
      <article
        className="hautsfaits-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hautsfaits-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <FeatCover feat={feat} photo={photos[0] ?? null} large>
          <button ref={closeRef} className="hautsfaits-sheet-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
          <h2 id="hautsfaits-sheet-title" className="hautsfaits-cover-title">
            {feat.title}
          </h2>
        </FeatCover>

        <div className="hautsfaits-sheet-body">
          <p className="hautsfaits-sheet-since">
            {capitalize(since)}
            {age && <> · {ageLabel(age, feat.datePrecision)}</>}
          </p>
          <p className="hautsfaits-sheet-when">
            <strong>{formatFeatSpan(feat)}</strong>
            {duration && <> · {duration}</>}
            {feat.place && <> · {feat.place}</>}
          </p>

          <div className="hautsfaits-sheet-facts">
            <span className="hautsfaits-fact" style={{ '--hautsfaits-c': info.color } as React.CSSProperties}>
              <span aria-hidden="true">{info.emoji}</span> {info.label}
            </span>
            {feat.people && (
              <span className="hautsfaits-fact">
                <span aria-hidden="true">👥</span> {feat.people}
              </span>
            )}
          </div>

          {feat.story && <p className="hautsfaits-sheet-story">{feat.story}</p>}

          <PhotoGallery title={feat.title} photos={photos} busy={uploading} onAdd={onAddPhotos} onMakeCover={onMakeCover} onRemove={onRemovePhoto} />

          {!birthDate && (
            <p className="hautsfaits-sheet-invite">
              <button className="hautsfaits-link" onClick={onAddBirthDate}>
                Ajoute ta date de naissance
              </button>{' '}
              pour voir l’âge que tu avais.
            </p>
          )}
        </div>

        <footer className="hautsfaits-sheet-foot">
          {confirming ? (
            <>
              <span className="hautsfaits-sheet-confirm">Supprimer « {feat.title} » pour de bon ?</span>
              <button className="btn btn-sm" onClick={() => setConfirming(false)} disabled={busy}>
                Garder
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => void remove()} disabled={busy}>
                Supprimer
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm btn-danger" onClick={() => setConfirming(true)}>
                Supprimer…
              </button>
              <span className="hautsfaits-spacer" />
              <button className="btn btn-primary btn-sm" onClick={onEdit}>
                Modifier
              </button>
            </>
          )}
        </footer>
      </article>
    </div>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
