import { useEffect, useRef, useState } from 'react';
import { IMAGE_KIND_LABELS } from '../lib/images';
import { PROJECT_IMAGE_KINDS, PROJECT_IMAGES_MAX, type ProjectImage, type ProjectImageKind } from '../lib/types';
import { ProjectImg } from './ProjectImg';
import { useSaving } from './useSaving';

interface Props {
  images: readonly ProjectImage[];
  /** Un message si les images n'ont pas pu être lues (table pas encore créée…). */
  loadError: string;
  onAdd: (kind: ProjectImageKind, files: File[]) => Promise<string | null>;
  onSetKind: (image: ProjectImage, kind: ProjectImageKind) => Promise<void>;
  onRemove: (image: ProjectImage) => Promise<void>;
}

/**
 * Le logo et quelques images du projet (§3.6) : réduites dans le navigateur
 * avant l'envoi, vingt au plus. Les gros fichiers du client restent dans son
 * dossier partagé, par un lien.
 */
export function ImagesPanel({ images, loadError, onAdd, onSetKind, onRemove }: Props) {
  const [kind, setKind] = useState<ProjectImageKind>(images.some((i) => i.kind === 'logo') ? 'photo' : 'logo');
  const [notice, setNotice] = useState('');
  const [viewing, setViewing] = useState<ProjectImage | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const { saving, error, run } = useSaving();

  async function pick(files: FileList | null) {
    if (!files || files.length === 0) return;
    const chosen = [...files];
    if (input.current) input.current.value = '';
    setNotice('');
    await run(async () => {
      const message = await onAdd(kind, chosen);
      if (message) setNotice(message);
    });
  }

  return (
    <section className="projets-images" aria-label="Logo et images">
      <h2 className="projets-section-title">
        Logo et images <span className="projets-count">{images.length}</span>
      </h2>
      {loadError ? (
        <div className="notice error">{loadError}</div>
      ) : (
        <>
          {images.length > 0 && (
            <ul className="projets-image-grid">
              {images.map((image) => (
                <li key={image.id} className="projets-image-cell">
                  <button type="button" className="projets-image-open" aria-label={`Agrandir : ${IMAGE_KIND_LABELS[image.kind]}`} onClick={() => setViewing(image)}>
                    <ProjectImg image={image} size="thumb" alt={IMAGE_KIND_LABELS[image.kind]} />
                  </button>
                  <div className="projets-image-meta">
                    <select
                      aria-label="Sorte d’image"
                      value={image.kind}
                      onChange={(e) => void run(() => onSetKind(image, e.target.value as ProjectImageKind))}
                    >
                      {PROJECT_IMAGE_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {IMAGE_KIND_LABELS[k]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm projets-edit-btn"
                      aria-label="Retirer l’image"
                      onClick={() => window.confirm('Retirer cette image ?') && void run(() => onRemove(image))}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="projets-image-add">
            <select aria-label="Sorte des images à ajouter" value={kind} onChange={(e) => setKind(e.target.value as ProjectImageKind)}>
              {PROJECT_IMAGE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {IMAGE_KIND_LABELS[k]}
                </option>
              ))}
            </select>
            <button className="btn btn-sm" disabled={saving || images.length >= PROJECT_IMAGES_MAX} onClick={() => input.current?.click()}>
              {saving ? 'Envoi…' : '+ Ajouter des images'}
            </button>
            <input ref={input} type="file" accept="image/*" multiple hidden aria-label="Choisir des images" onChange={(e) => void pick(e.target.files)} />
          </div>
          {images.length >= PROJECT_IMAGES_MAX && <p className="projets-hint">{PROJECT_IMAGES_MAX} images au plus : les gros fichiers du client restent dans son dossier partagé.</p>}
          {notice && <p className="projets-hint">{notice}</p>}
          {error && <div className="notice error">{error}</div>}
        </>
      )}
      {viewing && <ImageViewer image={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}

/** L'image en grand. Échap ou un toucher la referme. */
function ImageViewer({ image, onClose }: { image: ProjectImage; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay projets-viewer" role="dialog" aria-modal="true" aria-label="Image en grand" onClick={onClose}>
      <ProjectImg image={image} size="full" alt={IMAGE_KIND_LABELS[image.kind]} className="projets-viewer-img" />
      <button className="btn btn-sm projets-viewer-close" onClick={onClose} aria-label="Fermer">
        ✕
      </button>
    </div>
  );
}
