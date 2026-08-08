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
 */

const KEY = 'zenith.outbox.v1';

export type PendingOp =
  | {
      kind: 'add';
      /** Identifiant de l'opération, sert aussi d'id provisoire au check-in */
      id: string;
      goalId: string;
      actionId: string;
      day: string;
      pp: number;
      /** Quantité relevée, pour une action quantifiée cochée hors ligne */
      value: number | null;
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

type Listener = (ops: PendingOp[]) => void;
const listeners = new Set<Listener>();

function read(): PendingOp[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingOp[]) : [];
  } catch {
    return [];
  }
}

function write(ops: PendingOp[]) {
  try {
    if (ops.length === 0) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(ops));
  } catch {
    // Stockage plein ou refusé : on ne peut rien garantir de plus.
  }
  listeners.forEach((l) => l(ops));
}

export function listPending(): PendingOp[] {
  return read();
}

export function onPendingChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function newOpId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Range une coche à envoyer plus tard. Renvoie l'id provisoire du check-in. */
export function queueAdd(input: {
  goalId: string;
  actionId: string;
  day: string;
  pp: number;
  value?: number | null;
}): string {
  const id = newOpId();
  const ops = read();
  // Une coche annulée puis recochée hors ligne : la suppression en attente
  // disparaît, les deux s'annulent.
  const filtered = ops.filter(
    (op) => !(op.kind === 'add' && op.actionId === input.actionId && op.day === input.day),
  );
  filtered.push({ kind: 'add', id, ...input, value: input.value ?? null, at: Date.now() });
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
    // la double pas.
    const already = result.some((c) => c.actionId === op.actionId && c.day === op.day);
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
      },
    ];
  }
  return result;
}

/**
 * Panne de réseau, ou refus du serveur ?
 *
 * La distinction compte : une panne de réseau se met en file et se rejoue, un
 * refus du serveur (droits, contrainte violée) ne se rejouera jamais et doit
 * remonter à l'utilisateur. `fetch` échoue avec un TypeError quand la requête
 * n'a pas pu partir — c'est notre signal.
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /failed to fetch|networkerror|network request failed|load failed|réseau/i.test(message);
}
