import { IndexedDbBlobStore, MemoryBlobStore, type BlobStore } from '../../../core/data/images/blobStore';
import { createImageCache } from '../../../core/data/images/imageCache';

/**
 * Où Tier lists range ses images sur l'appareil. Les mécanismes sont au socle
 * (`core/data/images/`) ; les NOMS sont au module, et ce sont des
 * identifiants de stockage (CLAUDE.md §4) : ne jamais les renommer.
 *
 *  · `atlas-tierlists` (IndexedDB) : les images elles-mêmes, en mode local ;
 *  · `tierlists-images-v1` (Cache API) : les images déjà téléchargées, avec un compte.
 */
export function deviceBlobs(): BlobStore {
  return typeof indexedDB === 'undefined' ? new MemoryBlobStore() : new IndexedDbBlobStore('atlas-tierlists', 'images');
}

export const imageCache = createImageCache('tierlists-images-v1', '/__tierlists-image/');
