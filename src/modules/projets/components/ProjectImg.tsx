import { useEffect, useState } from 'react';
import type { ImageSize } from '../../../core/lib/images';
import { projetsStore } from '../data';
import type { ProjectImage } from '../lib/types';

/**
 * Une image de projet à l'écran. Lue par le contrat de stockage (IndexedDB ou
 * Supabase), elle devient une adresse `blob:` gardée pour la session — même
 * motif que les photos de Hauts faits.
 */
const urls = new Map<string, Promise<string>>();
const keyOf = (image: ProjectImage, size: ImageSize) => `${size}:${size === 'full' ? image.path : image.thumbPath}`;

function imageUrl(image: ProjectImage, size: ImageSize): Promise<string> {
  const key = keyOf(image, size);
  let url = urls.get(key);
  if (!url) {
    url = projetsStore.imageBlob(image, size).then((blob) => URL.createObjectURL(blob));
    // Un échec n'est pas gardé : la prochaine fois, on réessaie.
    url.catch(() => urls.delete(key));
    urls.set(key, url);
  }
  return url;
}

/** Oublier une image retirée : son adresse ne servira plus. */
export function forgetImage(image: ProjectImage) {
  for (const size of ['thumb', 'full'] as const) {
    const key = keyOf(image, size);
    void urls.get(key)?.then(URL.revokeObjectURL, () => undefined);
    urls.delete(key);
  }
}

export function ProjectImg({ image, size, alt, className = '' }: { image: ProjectImage; size: ImageSize; alt: string; className?: string }) {
  const key = keyOf(image, size);
  const [state, setState] = useState<{ key: string; url: string | null; failed: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    imageUrl(image, size).then(
      (url) => alive && setState({ key, url, failed: false }),
      () => alive && setState({ key, url: null, failed: true }),
    );
    return () => {
      alive = false;
    };
  }, [image, size, key]);

  const current = state?.key === key ? state : null;
  if (current?.failed) {
    return (
      <span className={`projets-img-missing ${className}`} role="img" aria-label={`${alt} (image introuvable)`}>
        Image introuvable
      </span>
    );
  }
  return current?.url ? <img className={`projets-img ${className}`} src={current.url} alt={alt} draggable={false} /> : <span className={`projets-img-loading ${className}`} />;
}
