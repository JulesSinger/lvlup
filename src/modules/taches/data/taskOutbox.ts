import { newOpId, type QueuedOp } from '../../../core/data/outbox';
import type { Task, TaskInput, TaskPatch } from '../lib/types';

/**
 * Les écritures de tâches en attente de réseau (étape 7, docs/etude-taches.md
 * §12) — la forme des opérations et leur réapplication à l'écran. Le
 * stockage de la file et les règles de vidage sont ceux du socle
 * (`core/data/outbox.ts`), partagés avec Zénith et Cérès.
 *
 * Seules les tâches passent par la file : c'est elles qu'on note ou qu'on
 * coche en chemin. Une liste se crée à tête reposée ; en cas d'échec, sa
 * fenêtre reste remplie.
 *
 * Chaque opération désigne sa tâche par l'id que l'application lui a choisi
 * avant le premier essai d'envoi (depuis l'étape 1) : c'est ce qui rend le
 * rejeu sans doublon possible (`createTask(input, id)`).
 */

/** La clé de la file. Un identifiant, pas un libellé : ne jamais la renommer. */
export const TACHES_OUTBOX_KEY = 'taches.outbox.v1';

/** Une création peut porter sa coche : la copie terminée d'une tâche répétée naît faite. */
export type QueuedInput = TaskInput & { completedAt?: string | null };

export type TaskOp =
  | (QueuedOp & { kind: 'create'; taskId: string; input: QueuedInput })
  | (QueuedOp & { kind: 'update'; taskId: string; patch: TaskPatch })
  | (QueuedOp & { kind: 'delete'; taskId: string });

const stamp = () => ({ id: newOpId(), at: Date.now() });

export function withCreate(ops: TaskOp[], taskId: string, input: QueuedInput): TaskOp[] {
  return [...ops, { kind: 'create', taskId, input, ...stamp() }];
}

/**
 * Une modification en attente. Si la tâche n'est pas encore partie, la
 * modification est fondue dans sa création : une seule écriture au retour du
 * réseau. Deux modifications successives se fondent de même.
 */
export function withUpdate(ops: TaskOp[], taskId: string, patch: TaskPatch): TaskOp[] {
  const create = ops.find((op) => op.kind === 'create' && op.taskId === taskId);
  if (create) return ops.map((op) => (op === create && op.kind === 'create' ? { ...op, input: { ...op.input, ...patch } as QueuedInput } : op));
  const update = ops.find((op) => op.kind === 'update' && op.taskId === taskId);
  if (update) return ops.map((op) => (op === update && op.kind === 'update' ? { ...op, patch: { ...op.patch, ...patch } } : op));
  return [...ops, { kind: 'update', taskId, patch, ...stamp() }];
}

/**
 * Une suppression en attente. Une tâche créée puis supprimée hors ligne n'a
 * jamais existé pour le serveur : ses opérations disparaissent, rien ne part.
 * Ses sous-tâches partent avec elle (la base le fait d'elle-même par la
 * cascade) : leurs opérations en attente deviennent sans objet.
 */
export function withDelete(ops: TaskOp[], taskId: string): TaskOp[] {
  const created = ops.some((op) => op.kind === 'create' && op.taskId === taskId);
  const children = new Set(ops.filter((op) => op.kind === 'create' && op.input.parentId === taskId).map((op) => op.taskId));
  const others = ops.filter((op) => op.taskId !== taskId && !children.has(op.taskId));
  if (created) return others;
  return [...others, { kind: 'delete', taskId, ...stamp() }];
}

/** Les tâches qui ont quelque chose en attente — marquées à l'écran. */
export function pendingTaskIds(ops: readonly TaskOp[]): Set<string> {
  return new Set(ops.map((op) => op.taskId));
}

/** Une tâche telle que la créerait le stockage, pour l'afficher avant qu'elle parte. */
export function taskFromInput(id: string, input: QueuedInput, at: number): Task {
  return {
    id,
    listId: input.listId ?? null,
    parentId: input.parentId ?? null,
    title: input.title,
    note: input.note ?? '',
    plannedDay: input.plannedDay ?? null,
    plannedTime: input.plannedDay ? (input.plannedTime ?? null) : null,
    durationMinutes: input.plannedDay && input.plannedTime ? (input.durationMinutes ?? null) : null,
    dueDay: input.dueDay ?? null,
    priority: input.priority ?? 'normale',
    recurrence: input.recurrence ?? null,
    repeatFrom: input.repeatFrom ?? 'schedule',
    position: input.position ?? 0,
    completedAt: input.completedAt ?? null,
    createdAt: new Date(at).toISOString(),
  };
}

/**
 * Réapplique la file par-dessus les tâches venues du serveur, pour que
 * l'écran reste fidèle à ce que l'utilisateur a fait — c'est ce qui empêche
 * un rafraîchissement d'effacer ce qui n'est pas encore parti. Une création
 * que le serveur a déjà (envoi réussi juste avant la coupure) n'est pas
 * doublée ; une tâche supprimée emporte ses sous-tâches.
 */
export function applyPendingTasks(server: readonly Task[], ops: readonly TaskOp[]): Task[] {
  if (ops.length === 0) return server.slice();
  const deleted = new Set(ops.filter((op) => op.kind === 'delete').map((op) => op.taskId));
  const patches = new Map<string, TaskPatch>();
  for (const op of ops) if (op.kind === 'update') patches.set(op.taskId, { ...patches.get(op.taskId), ...op.patch });

  const result: Task[] = server
    .filter((t) => !deleted.has(t.id) && !(t.parentId && deleted.has(t.parentId)))
    .map((t) => {
      const patch = patches.get(t.id);
      if (!patch) return t;
      const next = { ...t, ...patch };
      const timed = next.plannedDay ? next : { ...next, plannedTime: null };
      return timed.plannedTime ? timed : { ...timed, durationMinutes: null };
    });
  const known = new Set(result.map((t) => t.id));
  for (const op of ops) {
    if (op.kind === 'create' && !known.has(op.taskId)) result.push(taskFromInput(op.taskId, op.input, op.at));
  }
  return result;
}
