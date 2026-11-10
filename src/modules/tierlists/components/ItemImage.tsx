import { useEffect, useState } from 'react';
import type { ImageSize } from '../../../core/lib/images';
import { tierlistsStore } from '../data';
import type { TierItem } from '../lib/types';

/**
 * L'image d'un élément, lue par le contrat de stockage puis gardée en adresse
 * `blob:` pour la session — même motif que Recettes.
 */
const urls = new Map<string, Promise<string>>();
const keyOf = (item: TierItem, size: ImageSize) => `${size}:${size === 'full' ? item.image?.path : item.image?.thumbPath}`;

function imageUrl(item: TierItem, size: ImageSize): Promise<string> {
  const key = keyOf(item, size);
  let url = urls.get(key);
  if (!url) {
    url = tierlistsStore.imageBlob(item, size).then((blob) => URL.createObjectURL(blob));
    url.catch(() => urls.delete(key));
    urls.set(key, url);
  }
  return url;
}

/** Oublier l'image d'un élément supprimé. */
export function forgetImage(item: TierItem) {
  for (const size of ['thumb', 'full'] as const) {
    const key = keyOf(item, size);
    void urls.get(key)?.then(URL.revokeObjectURL, () => undefined);
    urls.delete(key);
  }
}

export function ItemImage({ item, size, className = '' }: { item: TierItem; size: ImageSize; className?: string }) {
  const key = item.image ? keyOf(item, size) : '';
  const [state, setState] = useState<{ key: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!item.image) return;
    let alive = true;
    imageUrl(item, size).then(
      (url) => alive && setState({ key, url }),
      () => alive && setState({ key, url: null }),
    );
    return () => {
      alive = false;
    };
  }, [item, size, key]);

  const url = item.image && state?.key === key ? state.url : null;
  if (url) return <img className={`tierlists-img ${className}`} src={url} alt={item.label} draggable={false} />;
  return <span className={`tierlists-img tierlists-img-empty ${className}`} role="img" aria-label={item.label || 'Image'} />;
}
