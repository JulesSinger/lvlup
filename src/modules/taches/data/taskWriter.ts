import { newId } from '../../../core/data/coreStore';
import { createFlusher, createOutbox, isNetworkError, type FlushResult, type Outbox } from '../../../core/data/outbox';
import type { Task, TaskPatch } from '../lib/types';
import { tachesStore } from './index';
import type { TachesStore } from './tachesStore';
import { pendingTaskIds, TACHES_OUTBOX_KEY, taskFromInput, withCreate, withDelete, withUpdate, type QueuedInput, type TaskOp } from './taskOutbox';

/**
 * Toutes les écritures de tâches de l'écran passent par ici (étape 7) : on
 * essaie d'écrire, et si **le réseau** manque — seulement lui —, l'écriture
 * part en file au lieu d'échouer. Un refus du serveur, lui, remonte : il ne
 * se rejouerait jamais. Même motif que le journal de Cérès.
 *
 * Deux règles d'ordre :
 *  · une tâche qui a déjà quelque chose en attente passe toujours par la
 *    file, même avec du réseau — sinon une modification écrite directement
 *    serait écrasée par une plus ancienne rejouée au retour du réseau ;
 *  · une sous-tâche dont la tâche attend encore passe aussi par la file :
 *    envoyée seule, elle serait refusée (sa tâche n'existe pas encore).
 *
 * Les méthodes portent les noms du contrat de stockage, si bien que
 * `applyCompletion` (cocher, défaire) s'y applique tel quel.
 */
export interface TaskWriter {
  createTask(input: QueuedInput, id?: string): Promise<Task>;
  updateTask(id: string, patch: TaskPatch): Promise<void>;
  deleteTask(id: string): Promise<void>;
  flush(): Promise<FlushResult>;
  pending(): TaskOp[];
  onPendingChange(listener: (ops: TaskOp[]) => void): () => void;
}

/** Créer, et cocher dans la foulée ce qui naît fait (la copie d'une tâche répétée). */
async function create(store: TachesStore, id: string, input: QueuedInput) {
  const { completedAt, ...fields } = input;
  const task = await store.createTask(fields, id);
  if (completedAt) await store.updateTask(id, { completedAt });
  return completedAt ? { ...task, completedAt } : task;
}

export function createTaskWriter(store: TachesStore, box: Outbox<TaskOp>): TaskWriter {
  const flush = createFlusher(box, async (op) => {
    if (op.kind === 'create') await create(store, op.taskId, op.input);
    else if (op.kind === 'update') await store.updateTask(op.taskId, op.patch);
    else await store.deleteTask(op.taskId);
  });

  const hasPending = (id: string | null | undefined) => !!id && pendingTaskIds(box.list()).has(id);

  /** Écrit directement ; en cas de coupure réseau, met en file avec `enqueue`. */
  async function attempt<T>(write: () => Promise<T>, enqueue: () => T): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      return enqueue();
    }
  }

  return {
    async createTask(input, id = newId()) {
      const queue = () => {
        box.replace(withCreate(box.list(), id, input));
        return taskFromInput(id, input, Date.now());
      };
      if (hasPending(input.parentId)) return queue();
      return attempt(() => create(store, id, input), queue);
    },

    async updateTask(id, patch) {
      const queue = () => box.replace(withUpdate(box.list(), id, patch));
      if (hasPending(id)) {
        queue();
        void flush();
        return;
      }
      return attempt(() => store.updateTask(id, patch), queue);
    },

    async deleteTask(id) {
      const queue = () => box.replace(withDelete(box.list(), id));
      if (hasPending(id)) {
        queue();
        void flush();
        return;
      }
      return attempt(() => store.deleteTask(id), queue);
    },

    flush,
    pending: () => box.list(),
    onPendingChange: (listener) => box.onChange(listener),
  };
}

/** Le rédacteur des tâches de l'application, sur le stockage actif. */
export const taskWriter = createTaskWriter(tachesStore, createOutbox<TaskOp>(TACHES_OUTBOX_KEY));
