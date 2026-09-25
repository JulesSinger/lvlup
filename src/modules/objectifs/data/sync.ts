import { createFlusher, type FlushResult } from '../../../core/data/outbox';
import { goalsStore } from './index';
import { zenithOutbox, type PendingOp } from './outbox';

/**
 * Vidage de la file d'attente : on rejoue les coches mises de côté pendant une
 * coupure, dans l'ordre où elles ont été faites.
 *
 * Les règles de vidage (une erreur réseau garde la suite, une erreur du
 * serveur retire l'opération) vivent dans le socle depuis le 25/09/2026
 * (`core/data/outbox.ts#createFlusher`) ; reste ici la façon d'envoyer une
 * coche, qui n'appartient qu'à Zénith.
 */
export type { FlushResult };

async function send(op: PendingOp) {
  if (op.kind === 'add' && op.actionId === null) {
    // Geste ponctuel : pas d'action, donc pas d'upsert possible. Le
    // dédoublonnage se fait en amont, dans `applyPending`.
    await goalsStore.addOneOff(op.goalId, op.day, op.title ?? '', op.pp, op.value);
  } else if (op.kind === 'add') {
    // `addCheckin` est un upsert : rejouer deux fois la même coche ne
    // crée pas de doublon.
    await goalsStore.addCheckin(op.goalId, op.day, op.actionId as string, op.pp, op.value);
  } else {
    await goalsStore.deleteCheckin(op.checkinId);
  }
}

export const flushOutbox: () => Promise<FlushResult> = createFlusher(zenithOutbox, send);
