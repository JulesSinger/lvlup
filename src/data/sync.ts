import { store } from './index';
import { isNetworkError, listPending, removeOp } from './outbox';

/**
 * Vidage de la file d'attente : on rejoue les coches mises de côté pendant une
 * coupure, dans l'ordre où elles ont été faites.
 *
 * Deux règles :
 *  · une erreur réseau interrompt le vidage et garde la suite pour plus tard —
 *    inutile de marteler un serveur injoignable ;
 *  · une erreur du serveur (droits, contrainte) retire l'opération, parce
 *    qu'elle ne réussira jamais et bloquerait la file pour toujours. Le
 *    message remonte à l'appelant, qui l'affiche une fois.
 */
export interface FlushResult {
  sent: number;
  remaining: number;
  /** Opérations abandonnées parce que le serveur les a refusées */
  dropped: string[];
}

let running: Promise<FlushResult> | null = null;

export function flushOutbox(): Promise<FlushResult> {
  // Un seul vidage à la fois : « online » et « visibilitychange » se
  // déclenchent souvent coup sur coup au réveil du téléphone.
  if (running) return running;
  running = run().finally(() => {
    running = null;
  });
  return running;
}

async function run(): Promise<FlushResult> {
  const dropped: string[] = [];
  let sent = 0;

  for (const op of listPending()) {
    try {
      if (op.kind === 'add') {
        // `addCheckin` est un upsert : rejouer deux fois la même coche ne
        // crée pas de doublon.
        await store.addCheckin(op.goalId, op.day, op.actionId, op.pp);
      } else {
        await store.deleteCheckin(op.checkinId);
      }
      removeOp(op.id);
      sent += 1;
    } catch (error) {
      if (isNetworkError(error)) break; // toujours hors ligne : on reprendra
      removeOp(op.id);
      dropped.push(error instanceof Error ? error.message : 'Envoi refusé.');
    }
  }

  return { sent, remaining: listPending().length, dropped };
}
