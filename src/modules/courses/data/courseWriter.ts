import { createFlusher, createOutbox, isNetworkError, type FlushResult, type Outbox } from '../../../core/data/outbox';
import type { ExpenseService } from '../../../core/lib/services';
import { expenseForTrip } from '../lib/budgetLink';
import { nextTripNumber } from '../lib/trip';
import type { Trip } from '../lib/types';
import { alreadyClosed, COURSES_OUTBOX_KEY, stamp, withOp, type CourseChange, type CourseOp } from './courseOutbox';
import type { CoursesStore } from './coursesStore';
import { coursesStore } from './index';

/**
 * Toutes les écritures de l'écran de Courses passent par ici (09/11/2026) :
 * on essaie d'écrire, et si le réseau manque — ou traîne : au fond d'un
 * hypermarché, une requête peut rester pendue de longues secondes —,
 * l'écriture part en file au lieu d'échouer. Un refus du serveur, lui,
 * remonte : il ne se rejouerait jamais.
 *
 * Deux règles :
 *  · dès que la file n'est pas vide, tout y passe, dans l'ordre : une coche
 *    écrite directement ne doit jamais être écrasée par une plus ancienne
 *    rejouée ensuite ;
 *  · une écriture trop lente part en file elle aussi. Elle peut encore
 *    aboutir de son côté : c'est sans danger, chaque envoi est rejouable sans
 *    doublon (identifiants choisis par l'app, clôture reconnue).
 */
export interface CourseWriter {
  /** `sent` : écrit sur le serveur ; `queued` : gardé sur l'appareil, partira au retour du réseau. */
  /**
   * Une opération déjà estampillée (`stamp`), pour que l'écran l'applique
   * d'avance à ce qu'il montre, ou une simple modification.
   * Envoyée directement, une course terminée ne crée pas sa dépense : l'écran
   * s'en charge et dit si elle a échoué ; rejouée depuis la file, si.
   */
  run(change: CourseChange | CourseOp): Promise<{ status: 'sent' | 'queued'; trip?: Trip }>;
  flush(): Promise<FlushResult>;
  pending(): CourseOp[];
  onPendingChange(listener: (ops: CourseOp[]) => void): () => void;
  /** Le service de Budget, pour créer la dépense d'une course terminée hors ligne quand elle part. */
  useExpenses(expenses: ExpenseService | undefined): void;
}

/** Au-delà, une écriture est tenue pour perdue dans le réseau : on la garde en file. */
export const SLOW_WRITE_MS = 6000;

class TooSlow extends TypeError {
  constructor() {
    super('Réseau trop lent.');
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TooSlow()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function createCourseWriter(store: CoursesStore, box: Outbox<CourseOp>, slowMs = SLOW_WRITE_MS): CourseWriter {
  let expenses: ExpenseService | undefined;

  async function send(op: CourseOp, withBudget: boolean): Promise<Trip | undefined> {
    switch (op.kind) {
      case 'createItem':
        await store.createItem(op.input, op.itemId);
        return;
      case 'updateItem':
        await store.updateItem(op.itemId, op.patch);
        return;
      case 'deleteItem':
        await store.deleteItem(op.itemId);
        return;
      case 'addEntry':
        await store.addEntry(op.itemId, op.quantity, op.note, op.entryId);
        return;
      case 'updateEntry':
        await store.updateEntry(op.entryId, op.patch);
        return;
      case 'removeEntry':
        await store.removeEntry(op.entryId);
        return;
      case 'createStore':
        await store.createStore(op.name, op.storeId);
        return;
      case 'closeTrip':
        return closeTrip(op, withBudget);
    }
  }

  /**
   * Terminer une course, sans jamais la doubler ni la perdre :
   *  · déjà là (envoi réussi juste avant une coupure) : rien de plus ;
   *  · son numéro pris entre-temps (une course terminée sur un autre appareil) :
   *    elle prend le suivant ;
   *  · le plan est ajusté à la liste d'aujourd'hui : une ligne déjà retirée ou
   *    un habituel déjà revenu feraient refuser toute la clôture.
   */
  async function closeTrip(op: Extract<CourseOp, { kind: 'closeTrip' }>, withBudget: boolean): Promise<Trip> {
    const { plan } = op;
    const [trips, entries, items] = await Promise.all([store.listTrips(), store.listEntries(), store.listItems()]);
    let trip = alreadyClosed(trips, plan);
    if (!trip) {
      const removed = new Set(plan.removeEntryIds);
      const staying = new Set(entries.filter((e) => !removed.has(e.id)).map((e) => e.itemId));
      const known = new Set(items.map((i) => i.id));
      const listed = new Set(entries.map((e) => e.id));
      trip = await store.closeTrip({
        ...plan,
        trip: { ...plan.trip, number: trips.some((t) => t.number === plan.trip.number) ? nextTripNumber(trips) : plan.trip.number },
        removeEntryIds: plan.removeEntryIds.filter((id) => listed.has(id)),
        purchasedItemIds: plan.purchasedItemIds.filter((id) => known.has(id)),
        addItemIds: plan.addItemIds.filter((id) => known.has(id) && !staying.has(id)),
      });
    }
    // La dépense après la course ; un échec ici n'annule rien (« Ajouter au budget » dans l'historique).
    if (withBudget && op.budget && expenses) {
      try {
        await expenses.record({ ...expenseForTrip(trip), ...(op.budget.accountId ? { accountId: op.budget.accountId } : {}) });
      } catch {
        // rattrapable depuis l'historique
      }
    }
    return trip;
  }

  const flushQueue = createFlusher(box, async (op) => {
    await send(op, true);
  });
  /**
   * Les envois partis directement et pas encore revenus (trop lents, donc
   * aussi mis en file) : le vidage les attend. Sinon une clôture lente qui
   * aboutit pendant qu'on la rejoue serait faite deux fois.
   */
  const inflight = new Set<Promise<unknown>>();
  const flush = async (): Promise<FlushResult> => {
    // L'appareil se sait hors ligne : rien à tenter, on attendra l'événement « online ».
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { sent: 0, remaining: box.list().length, dropped: [] };
    await Promise.allSettled(inflight);
    // Un vidage déjà en cours (lancé pendant la coupure) rend son propre
    // résultat : s'il reste quelque chose, on repasse aussitôt, réseau revenu.
    const first = await flushQueue();
    if (first.remaining === 0) return first;
    const second = await flushQueue();
    return { sent: first.sent + second.sent, remaining: second.remaining, dropped: [...first.dropped, ...second.dropped] };
  };

  return {
    async run(change) {
      const op: CourseOp = 'id' in change ? change : stamp(change);
      const queue = () => {
        box.replace(withOp(box.list(), op));
        void flush();
        return { status: 'queued' as const };
      };
      if (box.list().length > 0 || (typeof navigator !== 'undefined' && navigator.onLine === false)) return queue();
      const sending = send(op, false);
      inflight.add(sending);
      void sending.then(
        () => inflight.delete(sending),
        () => inflight.delete(sending),
      );
      try {
        const trip = await withTimeout(sending, slowMs);
        return { status: 'sent', trip };
      } catch (error) {
        if (!isNetworkError(error)) throw error;
        return queue();
      }
    },
    flush,
    pending: () => box.list(),
    onPendingChange: (listener) => box.onChange(listener),
    useExpenses(next) {
      expenses = next;
    },
  };
}

/** Le rédacteur de Courses de l'application, sur le stockage actif. */
export const courseWriter = createCourseWriter(coursesStore, createOutbox<CourseOp>(COURSES_OUTBOX_KEY));
