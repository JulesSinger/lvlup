import { IndexedDbBlobStore, MemoryBlobStore, type BlobStore } from '../../../core/data/images/blobStore';

/**
 * Où Hauts faits range ses photos sur l'appareil, en mode local. Le stockage
 * lui-même est au socle (`core/data/images/blobStore.ts`) ; le NOM de la base
 * et de son magasin sont à Hauts faits, et ce sont des identifiants de
 * stockage : les renommer perdrait les photos déjà rangées (CLAUDE.md §4).
 */
const DB_NAME = 'atlas-hautsfaits';
const STORE = 'photos';

export function deviceBlobs(): BlobStore {
  return typeof indexedDB === 'undefined' ? new MemoryBlobStore() : new IndexedDbBlobStore(DB_NAME, STORE);
}
