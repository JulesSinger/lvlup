import { createOutbox, isNetworkError, newOpId } from '../../../core/data/outbox';
import type { Checkin } from '../lib/types';

/**
 * File d'attente hors ligne.
 *
 * Le problème qu'elle résout : cocher une action dans le métro affichait le
 * +PP (optimiste), l'appel réseau échouait, et le rafraîchissement suivant
 * effaçait la coche. Perdre une action faite est le seul bug impardonnable
 * d'un traqueur — celui qui donne envie de tout arrêter.
 *
 * Principe : quand l'écriture échoue pour cause de réseau (et seulement pour
 * cette raison), l'opération est rangée ici, dans le localStorage. Elle est
 * rejouée à la reconnexion, au retour au premier plan, et au démarrage. Entre
 * les deux, elle est réappliquée par-dessus les données du serveur pour que
 * l'écran reste fidèle à ce que l'utilisateur a fait.
 *
 * On ne met en file que les coches quotidiennes : ce sont les seules qui se
 * font en mobilité, à une main, et qu'on ne refera pas si elles disparaissent.
 * Créer un objectif hors ligne échouera toujours — et c'est acceptable, on ne
 * crée pas un objectif dans le métro.
 *
 * Depuis le 25/09/2026, le stockage, la notification et les règles de vidage
 * vivent dans le socle (`core/data/outbox.ts`), partagés avec Cérès. Ce
 * fichier garde ce qui est propre aux coches — la forme des opérations, leur
 * dédoublonnage, leur réapplication — et sa clé, qui ne bouge pas.
 */

const KEY = 'zenith.outbox.v1';

export type PendingOp =
  | {
      kind: 'add';
      /** Identifiant de l'opération, sert aussi d'id provisoire au check-in */
      id: string;
      goalId: string;
      /** `null` pour un geste ponctuel : il n'a pas d'action derrière. */
      actionId: string | null;
      day: string;
      pp: number;
      /** Quantité relevée, pour une action quantifiée cochée hors ligne */
      value: number | null;
      /** Titre d'un geste ponctuel ; `null` pour une coche ordinaire */
      title: string | null;
      at: number;
    }
  | {
      kind: 'delete';
      id: string;
      checkinId: string;
      at: number;
    };

/** Préfixe des check-ins qui n'existent que dans la file. */
export const PENDING_PREFIX = 'attente-';

/** La file de Zénith, dans le socle — vidée par `sync.ts`. */
export const zenithOutbox = createOutbox<PendingOp>(KEY);

const read = () => zenithOutbox.list();
const write = (ops: PendingOp[]) => zenithOutbox.replace(ops);

export function listPending(): PendingOp[] {
  return read();
}

export function onPendingChange(listener: (ops: PendingOp[]) => void): () => void {
  return zenithOutbox.onChange(listener);
}

/** Range une coche à envoyer plus tard. Renvoie l'id provisoire du check-in. */
export function queueAdd(input: {
  goalId: string;
  actionId: string | null;
  day: string;
  pp: number;
  value?: number | null;
  title?: string | null;
}): string {
  const id = newOpId();
  const ops = read();
  // Une coche annulée puis recochée hors ligne : la suppression en attente
  // disparaît, les deux s'annulent. Un geste ponctuel n'entre pas dans ce
  // dédoublonnage : il n'a pas d'action, et plusieurs le même jour sont
  // parfaitement légitimes — les confondre en effacerait un.
  const filtered =
    input.actionId === null
      ? ops
      : ops.filter(
          (op) => !(op.kind === 'add' && op.actionId === input.actionId && op.day === input.day),
        );
  filtered.push({
    kind: 'add',
    id,
    ...input,
    value: input.value ?? null,
    title: input.title ?? null,
    at: Date.now(),
  });
  write(filtered);
  return `${PENDING_PREFIX}${id}`;
}

/**
 * Range une annulation. Si la coche n'existait elle-même que dans la file
 * (cochée puis décochée hors ligne), les deux opérations s'effacent au lieu
 * de partir toutes les deux au serveur.
 */
export function queueDelete(checkinId: string) {
  const ops = read();
  if (checkinId.startsWith(PENDING_PREFIX)) {
    const opId = checkinId.slice(PENDING_PREFIX.length);
    write(ops.filter((op) => op.id !== opId));
    return;
  }
  const filtered = ops.filter((op) => !(op.kind === 'delete' && op.checkinId === checkinId));
  filtered.push({ kind: 'delete', id: newOpId(), checkinId, at: Date.now() });
  write(filtered);
}

export function removeOp(id: string) {
  write(read().filter((op) => op.id !== id));
}

export function clearPending() {
  write([]);
}

/**
 * Réapplique la file par-dessus les check-ins venus du serveur.
 * C'est ce qui empêche un `refresh()` d'effacer ce qui n'est pas encore parti.
 */
export function applyPending(serverCheckins: Checkin[], ops: PendingOp[] = read()): Checkin[] {
  if (ops.length === 0) return serverCheckins;

  const deleted = new Set(
    ops.filter((op): op is Extract<PendingOp, { kind: 'delete' }> => op.kind === 'delete')
      .map((op) => op.checkinId),
  );
  let result = serverCheckins.filter((c) => !deleted.has(c.id));

  for (const op of ops) {
    if (op.kind !== 'add') continue;
    // Si le serveur a finalement la ligne (envoi réussi entre-temps), on ne
    // la double pas. Un geste ponctuel n'a pas d'action pour l'identifier :
    // on le reconnaît à son titre et à son jour.
    const already =
      op.actionId === null
        ? result.some((c) => c.title === op.title && c.day === op.day)
        : result.some((c) => c.actionId === op.actionId && c.day === op.day);
    if (already) continue;
    result = [
      ...result,
      {
        id: `${PENDING_PREFIX}${op.id}`,
        goalId: op.goalId,
        actionId: op.actionId,
        pp: op.pp,
        day: op.day,
        note: '',
        createdAt: new Date(op.at).toISOString(),
        value: op.value ?? null,
        title: op.title ?? null,
      },
    ];
  }
  return result;
}

/** Remontée dans le socle ; réexportée pour les appelants existants. */
export { isNetworkError };
