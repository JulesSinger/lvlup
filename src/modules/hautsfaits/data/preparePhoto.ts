import { prepareImage } from '../../../core/data/images/prepareImage';
import { PHOTO_FULL_SIZE, PHOTO_THUMB_SIZE, type PreparedPhoto } from '../lib/types';

/**
 * Réduire une photo de haut fait avant tout envoi (docs/etude-hauts-faits.md
 * §5.2) : 2 048 px et une miniature de 720 px. Le travail lui-même est au
 * socle (`core/data/images/prepareImage.ts`).
 */
export function preparePhoto(file: File): Promise<PreparedPhoto> {
  return prepareImage(file, { full: PHOTO_FULL_SIZE, thumb: PHOTO_THUMB_SIZE });
}
