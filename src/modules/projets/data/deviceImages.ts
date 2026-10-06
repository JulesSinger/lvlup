import { IndexedDbBlobStore, MemoryBlobStore, type BlobStore } from '../../../core/data/images/blobStore';
import { createImageCache } from '../../../core/data/images/imageCache';

/**
 * Où Projets range ses images sur l'appareil. Les mécanismes sont au socle
 * (`core/data/images/`) ; les NOMS sont à Projets, et ce sont des
 * identifiants de stockage (CLAUDE.md §4) : ne jamais les renommer.
 *
 *  · `atlas-projets` (IndexedDB) : les images elles-mêmes, en mode local ;
 *  · `projets-images-v1` (Cache API) : les images déjà téléchargées, avec un compte.
 */
export function deviceBlobs(): BlobStore {
  return typeof indexedDB === 'undefined' ? new MemoryBlobStore() : new IndexedDbBlobStore('atlas-projets', 'images');
}

export const imageCache = createImageCache('projets-images-v1', '/__projets-image/');
