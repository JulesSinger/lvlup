import { useEffect, useState } from 'react';
import { hautsFaitsStore } from '../data';
import type { FeatPhoto, PhotoSize } from '../lib/types';

/**
 * Une photo à l'écran. L'image se lit par le contrat de stockage (IndexedDB
 * ou Supabase), devient une adresse `blob:` gardée pour la session : une
 * miniature vue dans la frise ne se relit pas en ouvrant la fiche.
 */
const urls = new Map<string, Promise<string>>();
const keyOf = (photo: FeatPhoto, size: PhotoSize) => `${size}:${size === 'full' ? photo.path : photo.thumbPath}`;

function photoUrl(photo: FeatPhoto, size: PhotoSize): Promise<string> {
  const key = keyOf(photo, size);
  let url = urls.get(key);
  if (!url) {
    url = hautsFaitsStore.photoBlob(photo, size).then((blob) => URL.createObjectURL(blob));
    // Un échec n'est pas gardé : la prochaine fois, on réessaie.
    url.catch(() => urls.delete(key));
    urls.set(key, url);
  }
  return url;
}

/** Oublier une photo retirée : son adresse ne servira plus. */
export function forgetPhoto(photo: FeatPhoto) {
  for (const size of ['thumb', 'full'] as const) {
    const key = keyOf(photo, size);
    void urls.get(key)?.then(URL.revokeObjectURL, () => undefined);
    urls.delete(key);
  }
}

export function usePhotoUrl(photo: FeatPhoto | null, size: PhotoSize): { url: string | null; failed: boolean } {
  const [state, setState] = useState<{ key: string; url: string | null; failed: boolean } | null>(null);
  const key = photo ? keyOf(photo, size) : null;

  useEffect(() => {
    if (!photo || !key) return;
    let alive = true;
    photoUrl(photo, size).then(
      (url) => alive && setState({ key, url, failed: false }),
      () => alive && setState({ key, url: null, failed: true }),
    );
    return () => {
      alive = false;
    };
  }, [photo, size, key]);

  return state && state.key === key ? { url: state.url, failed: state.failed } : { url: null, failed: false };
}

/**
 * L'image, en `object-fit: cover` par défaut. Tant qu'elle charge, la place
 * est tenue ; si elle manque (restaurée ailleurs, supprimée du stockage), on
 * le dit plutôt que de laisser un cadre vide.
 */
export function PhotoImg({
  photo,
  size,
  alt,
  className = '',
  fallback,
}: {
  photo: FeatPhoto;
  size: PhotoSize;
  alt: string;
  className?: string;
  /** Ce qu'on montre pendant le chargement de la grande version (la miniature). */
  fallback?: PhotoSize;
}) {
  const { url, failed } = usePhotoUrl(photo, size);
  const { url: fallbackUrl } = usePhotoUrl(fallback && !url ? photo : null, fallback ?? 'thumb');
  if (failed) {
    return (
      <span className={`hautsfaits-photo-missing ${className}`} role="img" aria-label={`${alt} (photo introuvable)`}>
        Photo introuvable
      </span>
    );
  }
  const src = url ?? fallbackUrl;
  return src ? <img className={`hautsfaits-photo ${className}`} src={src} alt={alt} draggable={false} /> : <span className={`hautsfaits-photo-loading ${className}`} />;
}
