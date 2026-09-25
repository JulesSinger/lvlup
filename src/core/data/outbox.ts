/**
 * File d'attente hors ligne — la mécanique commune à tous les modules.
 *
 * Le problème qu'elle résout : une écriture faite sans réseau (une coche dans
 * le métro, un déjeuner noté au sous-sol d'un restaurant) ne doit jamais être
 * perdue. C'est le seul bug impardonnable ici (CLAUDE.md §1, règle 3).
 *
 * Née dans Zénith (`modules/objectifs/data/outbox.ts`), remontée ici le
 * 25/09/2026 quand Cérès a eu besoin de la même chose (CLAUDE.md §6) : le
 * socle garde le stockage, la notification et les règles de vidage ; chaque
 * module garde ses propres opérations et la façon de les réappliquer à
 * l'écran, qu'il est seul à connaître.
 *
 * Chaque file a sa clé localStorage, choisie par le module. **Une clé est un
 * identifiant, pas un libellé** : celle de Zénith reste `zenith.outbox.v1`,
 * la renommer effacerait les coches en attente (CLAUDE.md §4).
 */

/** Ce que toute opération en file porte, quel que soit son module. */
export interface QueuedOp {
  /** Identifiant de l'opération dans la file */
  id: string;
  /** Moment de la mise en file (ms), pour l'ordre et l'affichage */
  at: number;
}

export interface Outbox<Op extends QueuedOp> {
  /** Les opérations en attente, dans l'ordre où elles ont été faites. */
  list(): Op[];
  /** Remplace toute la file (après une fusion, une annulation…) et prévient les abonnés. */
  replace(ops: Op[]): void;
  remove(id: string): void;
  clear(): void;
  /** Appelé à chaque changement de la file ; renvoie de quoi se désabonner. */
  onChange(listener: (ops: Op[]) => void): () => void;
}

export function createOutbox<Op extends QueuedOp>(key: string): Outbox<Op> {
  const listeners = new Set<(ops: Op[]) => void>();

  function list(): Op[] {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as Op[]) : [];
    } catch {
      return [];
    }
  }

  function replace(ops: Op[]) {
    try {
      if (ops.length === 0) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(ops));
    } catch {
      // Stockage plein ou refusé : on ne peut rien garantir de plus.
    }
    listeners.forEach((l) => l(ops));
  }

  return {
    list,
    replace,
    remove: (id) => replace(list().filter((op) => op.id !== id)),
    clear: () => replace([]),
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Un identifiant d'opération, unique dans la file. */
export function newOpId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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

export interface FlushResult {
  sent: number;
  remaining: number;
  /** Opérations abandonnées parce que le serveur les a refusées */
  dropped: string[];
}

/**
 * Le vidage d'une file : rejouer les opérations dans l'ordre où elles ont
 * été faites, avec deux règles :
 *  · une erreur réseau interrompt le vidage et garde la suite pour plus
 *    tard — inutile de marteler un serveur injoignable ;
 *  · une erreur du serveur retire l'opération, parce qu'elle ne réussira
 *    jamais et bloquerait la file pour toujours. Le message remonte à
 *    l'appelant, qui l'affiche une fois.
 *
 * `send` doit être idempotent : une opération partie juste avant une coupure
 * peut être rejouée alors que le serveur l'a déjà reçue.
 */
export function createFlusher<Op extends QueuedOp>(
  outbox: Outbox<Op>,
  send: (op: Op) => Promise<void>,
): () => Promise<FlushResult> {
  let running: Promise<FlushResult> | null = null;

  async function run(): Promise<FlushResult> {
    const dropped: string[] = [];
    let sent = 0;
    for (const op of outbox.list()) {
      try {
        await send(op);
        outbox.remove(op.id);
        sent += 1;
      } catch (error) {
        if (isNetworkError(error)) break; // toujours hors ligne : on reprendra
        outbox.remove(op.id);
        dropped.push(error instanceof Error ? error.message : 'Envoi refusé.');
      }
    }
    return { sent, remaining: outbox.list().length, dropped };
  }

  // Un seul vidage à la fois : « online » et « visibilitychange » se
  // déclenchent souvent coup sur coup au réveil du téléphone.
  return () => {
    running ??= run().finally(() => {
      running = null;
    });
    return running;
  };
}
