import { createImageCache } from '../../../core/data/images/imageCache';

/**
 * Le cache des photos de Hauts faits sur l'appareil, avec un compte. Le
 * mécanisme est au socle (`core/data/images/imageCache.ts`) ; le nom du cache
 * est un identifiant de stockage (CLAUDE.md §4) : ne jamais le renommer.
 */
export const { cachedBlob, forgetCached } = createImageCache('hautsfaits-photos-v1', '/__hautsfaits-photo/');
