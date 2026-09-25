import { newOpId, type QueuedOp } from '../../../core/data/outbox';
import type { Entry, EntryInput } from '../lib/types';

/**
 * Les écritures du journal en attente de réseau (étape 7,
 * docs/etude-nutrition.md §10, §12) — la forme des opérations et leur
 * réapplication à l'écran. Le stockage de la file et les règles de vidage
 * sont ceux du socle (`core/data/outbox.ts`), partagés avec Zénith.
 *
 * Seul le journal passe par la file : c'est lui qu'on remplit à table, au
 * restaurant, sans toujours avoir de réseau. Un aliment perso ou un objectif
 * se crée à tête reposée ; en cas d'échec, leur formulaire reste rempli.
 *
 * Chaque opération désigne son entrée par l'id que l'application lui a
 * choisi (`entryId`) avant même le premier essai d'envoi : c'est ce qui rend
 * le rejeu sans doublon possible (`createEntry(input, id)`).
 */

/** La clé de la file. Un identifiant, pas un libellé : ne jamais la renommer. */
export const NUTRITION_OUTBOX_KEY = 'nutrition.outbox.v1';

export type EntryOp =
  | (QueuedOp & { kind: 'create'; entryId: string; input: EntryInput })
  | (QueuedOp & { kind: 'update'; entryId: string; patch: Partial<EntryInput> })
  | (QueuedOp & { kind: 'delete'; entryId: string });

const stamp = () => ({ id: newOpId(), at: Date.now() });

export function withCreate(ops: EntryOp[], entryId: string, input: EntryInput): EntryOp[] {
  return [...ops, { kind: 'create', entryId, input, ...stamp() }];
}

/**
 * Une correction en attente. Si l'entrée elle-même n'est pas encore partie,
 * la correction est fondue dans sa création : une seule écriture au retour
 * du réseau. Deux corrections successives se fondent de même.
 */
export function withUpdate(ops: EntryOp[], entryId: string, patch: Partial<EntryInput>): EntryOp[] {
  const create = ops.find((op) => op.kind === 'create' && op.entryId === entryId);
  if (create) {
    return ops.map((op) =>
      op === create && op.kind === 'create' ? { ...op, input: { ...op.input, ...patch } } : op,
    );
  }
  const update = ops.find((op) => op.kind === 'update' && op.entryId === entryId);
  if (update) {
    return ops.map((op) =>
      op === update && op.kind === 'update' ? { ...op, patch: { ...op.patch, ...patch } } : op,
    );
  }
  return [...ops, { kind: 'update', entryId, patch, ...stamp() }];
}

/**
 * Un retrait en attente. Une entrée ajoutée puis retirée hors ligne n'a
 * jamais existé pour le serveur : toutes ses opérations disparaissent, rien
 * ne part. Sinon ses corrections en attente deviennent sans objet.
 */
export function withDelete(ops: EntryOp[], entryId: string): EntryOp[] {
  const created = ops.some((op) => op.kind === 'create' && op.entryId === entryId);
  const others = ops.filter((op) => op.entryId !== entryId);
  if (created) return others;
  return [...others, { kind: 'delete', entryId, ...stamp() }];
}

/** Les entrées qui ont quelque chose en attente — marquées à l'écran. */
export function pendingEntryIds(ops: readonly EntryOp[]): Set<string> {
  return new Set(ops.map((op) => op.entryId));
}

/**
 * Réapplique la file par-dessus les entrées venues du serveur, pour que
 * l'écran reste fidèle à ce que l'utilisateur a fait — c'est ce qui empêche
 * un rafraîchissement d'effacer ce qui n'est pas encore parti.
 *
 * Une création que le serveur a déjà (même id : envoi réussi juste avant la
 * coupure) n'est pas doublée.
 */
export function applyPendingEntries(server: readonly Entry[], ops: readonly EntryOp[]): Entry[] {
  if (ops.length === 0) return server.slice();
  const deleted = new Set(ops.filter((op) => op.kind === 'delete').map((op) => op.entryId));
  const patches = new Map<string, Partial<EntryInput>>();
  for (const op of ops) {
    if (op.kind === 'update') patches.set(op.entryId, { ...patches.get(op.entryId), ...op.patch });
  }

  const result: Entry[] = server
    .filter((e) => !deleted.has(e.id))
    .map((e) => (patches.has(e.id) ? { ...e, ...patches.get(e.id) } : e));
  const known = new Set(result.map((e) => e.id));
  for (const op of ops) {
    if (op.kind !== 'create' || known.has(op.entryId)) continue;
    result.push({ ...op.input, id: op.entryId, createdAt: new Date(op.at).toISOString() });
  }
  return result;
}
