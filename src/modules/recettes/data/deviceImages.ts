import { IndexedDbBlobStore, MemoryBlobStore, type BlobStore } from '../../../core/data/images/blobStore';
import { createImageCache } from '../../../core/data/images/imageCache';

/**
 * Où Recettes range ses photos sur l'appareil. Les mécanismes sont au socle
 * (`core/data/images/`) ; les NOMS sont à Recettes, et ce sont des
 * identifiants de stockage (CLAUDE.md §4) : ne jamais les renommer.
 *
 *  · `atlas-recettes` (IndexedDB) : les photos elles-mêmes, en mode local ;
 *  · `recettes-photos-v1` (Cache API) : les photos déjà téléchargées, avec un compte.
 */
export function deviceBlobs(): BlobStore {
  return typeof indexedDB === 'undefined' ? new MemoryBlobStore() : new IndexedDbBlobStore('atlas-recettes', 'photos');
}

export const photoCache = createImageCache('recettes-photos-v1', '/__recettes-photo/');
