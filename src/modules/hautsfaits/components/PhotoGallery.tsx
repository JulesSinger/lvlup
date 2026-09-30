import { useState } from 'react';
import { PHOTOS_MAX, type FeatPhoto } from '../lib/types';
import { Lightbox } from './Lightbox';
import { PhotoImg } from './PhotoImg';
import { PhotoPicker } from './PhotoPicker';

/**
 * Les photos d'un haut fait, dans sa fiche : une galerie de miniatures, la
 * visionneuse au toucher, et « Arranger » pour choisir la couverture ou
 * retirer une photo — retirer demande un second toucher, une photo retirée
 * est perdue pour Atlas (l'original, lui, reste dans le téléphone).
 */
export function PhotoGallery({
  title,
  photos,
  busy,
  onAdd,
  onMakeCover,
  onRemove,
}: {
  title: string;
  photos: FeatPhoto[];
  /** Un envoi est en cours : on n'en commence pas un autre. */
  busy: boolean;
  onAdd: (files: File[]) => void;
  onMakeCover: (photo: FeatPhoto) => void;
  onRemove: (photo: FeatPhoto) => void;
}) {
  const [viewing, setViewing] = useState<number | null>(null);
  const [arranging, setArranging] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const room = PHOTOS_MAX - photos.length;

  return (
    <section className="hautsfaits-gallery" aria-label="Photos">
      {photos.length > 0 && (
        <ul className="hautsfaits-gallery-grid">
          {photos.map((photo, i) => (
            <li key={photo.id} className="hautsfaits-gallery-item">
              <button className="hautsfaits-gallery-thumb" onClick={() => setViewing(i)} aria-label={`Voir la photo ${i + 1}`}>
                <PhotoImg photo={photo} size="thumb" alt="" />
                {i === 0 && <span className="hautsfaits-gallery-cover">Couverture</span>}
              </button>
              {arranging && (
                <div className="hautsfaits-gallery-actions">
                  {i > 0 && (
                    <button className="hautsfaits-gallery-action" onClick={() => onMakeCover(photo)}>
                      En couverture
                    </button>
                  )}
                  {confirming === photo.id ? (
                    <button
                      className="hautsfaits-gallery-action danger"
                      onClick={() => {
                        setConfirming(null);
                        onRemove(photo);
                      }}
                    >
                      Retirer pour de bon
                    </button>
                  ) : (
                    <button className="hautsfaits-gallery-action" onClick={() => setConfirming(photo.id)}>
                      Retirer
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="hautsfaits-gallery-bar">
        {room > 0 ? (
          <PhotoPicker disabled={busy} onPick={onAdd} label={photos.length ? '＋ Photos' : '＋ Ajouter des photos'} />
        ) : (
          <span className="hautsfaits-gallery-full">{PHOTOS_MAX} photos, c’est le maximum.</span>
        )}
        {photos.length > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            aria-pressed={arranging}
            onClick={() => {
              setArranging((a) => !a);
              setConfirming(null);
            }}
          >
            {arranging ? 'Terminé' : 'Arranger'}
          </button>
        )}
      </div>

      {viewing !== null && <Lightbox photos={photos} start={viewing} title={title} onClose={() => setViewing(null)} />}
    </section>
  );
}
