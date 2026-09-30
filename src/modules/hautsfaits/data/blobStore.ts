/**
 * Où ranger des images sur l'appareil, sans compte.
 *
 * `localStorage` plafonne vers 5 Mo et ne garde que du texte : inutilisable
 * pour des photos (docs/etude-hauts-faits.md §5.5). IndexedDB garde des
 * `Blob` tels quels, et le navigateur lui accorde bien plus de place. Les
 * tests, eux, tournent sous Node sans IndexedDB : ils prennent la version en
 * mémoire.
 */
export interface BlobStore {
  put(key: string, blob: Blob): Promise<void>;
  get(key: string): Promise<Blob | null>;
  delete(keys: string[]): Promise<void>;
}

export class MemoryBlobStore implements BlobStore {
  private blobs = new Map<string, Blob>();

  async put(key: string, blob: Blob) {
    this.blobs.set(key, blob);
  }

  async get(key: string) {
    return this.blobs.get(key) ?? null;
  }

  async delete(keys: string[]) {
    for (const key of keys) this.blobs.delete(key);
  }

  get size() {
    return this.blobs.size;
  }
}

const DB_NAME = 'atlas-hautsfaits';
const STORE = 'photos';

/** Le nom de la base est un identifiant de stockage : ne jamais le renommer (CLAUDE.md §4). */
export class IndexedDbBlobStore implements BlobStore {
  private db: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Le navigateur refuse de ranger les photos (stockage de l’appareil indisponible).'));
    });
    return this.db;
  }

  private async run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => reject(tx.error ?? new Error('Stockage de l’appareil indisponible.'));
      tx.onabort = () => reject(tx.error ?? new Error('Stockage de l’appareil plein ou indisponible.'));
    });
  }

  async put(key: string, blob: Blob) {
    await this.run('readwrite', (store) => store.put(blob, key));
  }

  async get(key: string) {
    return ((await this.run<Blob>('readonly', (store) => store.get(key))) as Blob | undefined) ?? null;
  }

  async delete(keys: string[]) {
    if (keys.length === 0) return;
    await this.run('readwrite', (store) => {
      for (const key of keys) store.delete(key);
    });
  }
}
