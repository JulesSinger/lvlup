import { newId } from '../../../core/data/coreStore';
import { createFlusher, createOutbox, isNetworkError, type FlushResult, type Outbox } from '../../../core/data/outbox';
import type { EntryInput } from '../lib/types';
import { NUTRITION_OUTBOX_KEY, pendingEntryIds, withCreate, withDelete, withUpdate, type EntryOp } from './entryOutbox';
import { nutritionStore } from './index';
import type { NutritionStore } from './nutritionStore';

/**
 * Toutes les écritures du journal passent par ici (étape 7) : on essaie
 * d'écrire, et si **le réseau** manque — seulement lui —, l'écriture part en
 * file au lieu d'échouer. Un refus du serveur, lui, remonte : il ne se
 * rejouerait jamais.
 *
 * Règle d'ordre : une entrée qui a déjà quelque chose en attente passe
 * toujours par la file, même avec du réseau. Sinon une correction écrite
 * directement serait écrasée ensuite par une correction plus ancienne
 * rejouée au retour du réseau.
 */
export interface JournalWriter {
  /** `queued` : pas de réseau, l'entrée partira plus tard (elle s'affiche déjà). */
  add(input: EntryInput): Promise<{ id: string; queued: boolean }>;
  update(entryId: string, patch: Partial<EntryInput>): Promise<{ queued: boolean }>;
  remove(entryId: string): Promise<{ queued: boolean }>;
  flush(): Promise<FlushResult>;
  pending(): EntryOp[];
  onPendingChange(listener: (ops: EntryOp[]) => void): () => void;
}

export function createJournalWriter(store: NutritionStore, box: Outbox<EntryOp>): JournalWriter {
  const flush = createFlusher(box, async (op) => {
    if (op.kind === 'create') await store.createEntry(op.input, op.entryId);
    else if (op.kind === 'update') await store.updateEntry(op.entryId, op.patch);
    else await store.deleteEntry(op.entryId);
  });

  const hasPending = (entryId: string) => pendingEntryIds(box.list()).has(entryId);

  /** Écrit directement ; en cas de coupure réseau, met en file avec `enqueue`. */
  async function attempt(write: () => Promise<unknown>, enqueue: () => void): Promise<{ queued: boolean }> {
    try {
      await write();
      return { queued: false };
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      enqueue();
      return { queued: true };
    }
  }

  return {
    async add(input) {
      // L'id est choisi ici, avant le premier essai : si la réponse se perd
      // alors que le serveur a bien écrit, le rejeu ne créera pas de doublon.
      const id = newId();
      const { queued } = await attempt(
        () => store.createEntry(input, id),
        () => box.replace(withCreate(box.list(), id, input)),
      );
      return { id, queued };
    },

    async update(entryId, patch) {
      if (hasPending(entryId)) {
        box.replace(withUpdate(box.list(), entryId, patch));
        void flush();
        return { queued: true };
      }
      return attempt(
        () => store.updateEntry(entryId, patch),
        () => box.replace(withUpdate(box.list(), entryId, patch)),
      );
    },

    async remove(entryId) {
      if (hasPending(entryId)) {
        box.replace(withDelete(box.list(), entryId));
        void flush();
        return { queued: true };
      }
      return attempt(
        () => store.deleteEntry(entryId),
        () => box.replace(withDelete(box.list(), entryId)),
      );
    },

    flush,
    pending: () => box.list(),
    onPendingChange: (listener) => box.onChange(listener),
  };
}

/** Le rédacteur du journal de l'application, sur le stockage actif. */
export const journalWriter = createJournalWriter(nutritionStore, createOutbox<EntryOp>(NUTRITION_OUTBOX_KEY));
