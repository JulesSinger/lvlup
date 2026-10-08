import { useEffect, useState } from 'react';
import type { ImageSize } from '../../../core/lib/images';
import { recettesStore } from '../data';
import { CATEGORY_EMOJIS } from '../lib/categories';
import type { RecipeCategory, RecipePhoto } from '../lib/types';

/**
 * La photo d'une recette à l'écran, lue par le contrat de stockage (IndexedDB
 * ou Supabase) puis gardée en adresse `blob:` pour la session — même motif
 * que Projets et Hauts faits. Sans photo, la couverture à l'emblème de la
 * catégorie : une recette ne paraît jamais vide.
 */
const urls = new Map<string, Promise<string>>();
const keyOf = (photo: RecipePhoto, size: ImageSize) => `${size}:${size === 'full' ? photo.path : photo.thumbPath}`;

function photoUrl(photo: RecipePhoto, size: ImageSize): Promise<string> {
  const key = keyOf(photo, size);
  let url = urls.get(key);
  if (!url) {
    url = recettesStore.photoBlob(photo, size).then((blob) => URL.createObjectURL(blob));
    url.catch(() => urls.delete(key));
    urls.set(key, url);
  }
  return url;
}

/** Oublier une photo remplacée ou retirée : son adresse ne servira plus. */
export function forgetPhoto(photo: RecipePhoto) {
  for (const size of ['thumb', 'full'] as const) {
    const key = keyOf(photo, size);
    void urls.get(key)?.then(URL.revokeObjectURL, () => undefined);
    urls.delete(key);
  }
}

export function RecipeCover({ photo, category, size, alt, className = '' }: {
  photo: RecipePhoto | null;
  category: RecipeCategory;
  size: ImageSize;
  alt: string;
  className?: string;
}) {
  const key = photo ? keyOf(photo, size) : '';
  const [state, setState] = useState<{ key: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!photo) return;
    let alive = true;
    photoUrl(photo, size).then(
      (url) => alive && setState({ key, url }),
      () => alive && setState({ key, url: null }),
    );
    return () => {
      alive = false;
    };
  }, [photo, size, key]);

  const url = photo && state?.key === key ? state.url : null;
  if (url) return <img className={`recettes-cover ${className}`} src={url} alt={alt} draggable={false} />;
  return (
    <span className={`recettes-cover recettes-cover-empty recettes-cover-${category} ${className}`} role="img" aria-label={alt}>
      <span aria-hidden="true">{CATEGORY_EMOJIS[category]}</span>
    </span>
  );
}
