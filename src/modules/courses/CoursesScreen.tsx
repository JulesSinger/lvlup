import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { newId } from '../../core/data/coreStore';
import { isRemote } from '../../core/data';
import { isNetworkError } from '../../core/data/outbox';
import type { ExpenseAccount } from '../../core/lib/services';
import type { ModuleScreenProps } from '../../core/lib/module';
import { ModuleBrand } from '../../core/components/ModuleBrand';
import { AddItemBar } from './components/AddItemBar';
import { CloseTripDialog, type CloseForm } from './components/CloseTripDialog';
import { ItemEditor } from './components/ItemEditor';
import { ListLine } from './components/ListLine';
import { StatsView } from './components/StatsView';
import { TripsView } from './components/TripsView';
import { coursesStore } from './data';
import { applyPending, stamp, type CourseChange, type CourseData, type CourseOp } from './data/courseOutbox';
import { courseWriter, withTimeout } from './data/courseWriter';
import { readOfflineCopy, saveOfflineCopy } from './data/offlineCopy';
import { groupByAisle, guessAisle } from './lib/aisles';
import { formatEuros } from './lib/money';
import { estimateList, lastPrice } from './lib/prices';
import { expenseForTrip, tripRef } from './lib/budgetLink';
import { buildClosePlan, nextTripNumber, suggestedTotal } from './lib/trip';
import {
  AISLE_LABELS,
  type Item,
  type ItemInput,
  type ListEntry,
  type ListEntryPatch,
  type Trip,
} from './lib/types';

/** Au-delà, la liste ne se charge pas : on montre la copie du téléphone plutôt que d'attendre. */
const SLOW_LOAD_MS = 8000;

const EMPTY: CourseData = { items: [], entries: [], stores: [], trips: [], tripItems: [] };

const clock = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `à ${time}` : `le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} à ${time}`;
};

/**
 * Écran racine de Comète — la liste de courses, étape 3
 * (docs/etude-courses.md §12) : la V1.
 *
 * Une seule liste, rangée par rayon dans l'ordre d'un parcours de magasin.
 * On ajoute en tapant (le rayon se devine), on coche en magasin, on note le
 * prix de ce qu'on met dans le panier. « Terminer la course » (étape 4)
 * enregistre la course et remet les habituels ; l'onglet « Courses » en
 * garde l'historique, l'onglet « Chiffres » (étape 5) en tire les totaux.
 *
 * **Hors ligne** depuis le 09/11/2026 (« à Auchan je n'ai plus de connexion ») :
 * la liste se lit dans la copie gardée sur le téléphone (`data/offlineCopy.ts`),
 * et tout ce qu'on y fait — ajouter, cocher, un prix, terminer la course — passe
 * par `courseWriter`, qui écrit ou garde en file jusqu'au retour du réseau.
 * L'écran montre toujours les données du serveur **plus** la file
 * (`applyPending`) : rien de ce qui a été fait ne disparaît à un rafraîchissement.
 * Un refus du serveur, lui, est annulé à l'écran et dit.
 */
export function CoursesScreen({ error, onError, onOpenSettings, onSwitchModule, reloadToken, services, label, emoji }: ModuleScreenProps) {
  const expenses = services.expenses;
  /** Les données du serveur (ou de la copie du téléphone), ce qui a été envoyé compris. */
  const [server, setServer] = useState<CourseData>(EMPTY);
  /** Ce qui attend le réseau, réappliqué par-dessus. */
  const [pending, setPending] = useState<CourseOp[]>(() => courseWriter.pending());
  /** Hors ligne : la liste vient de la copie du téléphone, de ce moment-là. */
  const [offlineSince, setOfflineSince] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ListEntry | null>(null);
  const { items, entries, stores, trips, tripItems } = useMemo(() => applyPending(server, pending), [server, pending]);
  /** La liste, ou l'historique des courses (étape 4). */
  const [view, setView] = useState<'list' | 'trips' | 'stats'>('list');
  const [closing, setClosing] = useState(false);
  /** Les comptes du budget, demandés en ouvrant « Terminer la course » (« Payé avec »). */
  const [budgetAccounts, setBudgetAccounts] = useState<ExpenseAccount[]>([]);
  useEffect(() => {
    if (!closing || !expenses?.accounts) return;
    let alive = true;
    // Un échec ne gêne rien : la course part au compte principal, comme avant les comptes.
    expenses
      .accounts()
      .then((list) => alive && setBudgetAccounts(list))
      .catch(() => alive && setBudgetAccounts([]));
    return () => {
      alive = false;
    };
  }, [closing, expenses]);
  /** Le compte rendu de la dernière course terminée, jusqu'à la prochaine action. */
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [nextItems, nextEntries, nextTrips, nextTripItems, nextStores] = await withTimeout(
        Promise.all([coursesStore.listItems(), coursesStore.listEntries(), coursesStore.listTrips(), coursesStore.listTripItems(), coursesStore.listStores()]),
        SLOW_LOAD_MS,
      );
      const next = { items: nextItems, entries: nextEntries, trips: nextTrips, tripItems: nextTripItems, stores: nextStores };
      setServer(next);
      setOfflineSince(null);
      // La copie pour le prochain passage sans réseau (seulement avec un compte).
      if (isRemote) saveOfflineCopy(next);
      onError('');
    } catch (err) {
      if (!isNetworkError(err)) {
        onError(err instanceof Error ? err.message : 'Chargement impossible.');
        return;
      }
      // Pas de réseau, ou trop lent : la copie du téléphone, si on n'a rien de mieux sous la main.
      const copy = readOfflineCopy();
      setServer((current) => (current === EMPTY && copy ? copy : current));
      setOfflineSince(copy?.savedAt ?? new Date().toISOString());
      onError('');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Au montage, et après une restauration de sauvegarde (reloadToken).
  useEffect(() => {
    void refresh();
  }, [refresh, reloadToken]);

  // La file : suivie à l'écran, vidée dès que le réseau revient (ou que l'app revient au premier plan).
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    courseWriter.useExpenses(expenses);
    const off = courseWriter.onPendingChange(setPending);
    const flush = () => {
      if (courseWriter.pending().length === 0) return;
      void courseWriter.flush().then((result) => {
        if (result.dropped.length > 0) onError(`Pas pu être enregistré : ${result.dropped.join(' ; ')}`);
        if (result.sent > 0) void refreshRef.current();
      });
    };
    const onVisible = () => document.visibilityState === 'visible' && (flush(), void refreshRef.current());
    window.addEventListener('online', flush);
    document.addEventListener('visibilitychange', onVisible);
    flush();
    return () => {
      off();
      window.removeEventListener('online', flush);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses]);

  const groups = useMemo(() => groupByAisle(entries, items), [entries, items]);
  const nextTrip = useMemo(() => nextTripNumber(trips), [trips]);
  const inCart = entries.filter((e) => e.checked).length;
  const basket = useMemo(() => suggestedTotal(entries), [entries]);
  // Ce qui reste à prendre, d'après les prix des courses passées : le panier
  // a déjà ses prix saisis, les estimer une seconde fois ne ferait que les
  // répéter (et, à la toute première course, ne montrerait qu'eux).
  const estimate = useMemo(
    () => estimateList(entries.filter((e) => !e.checked), tripItems, trips),
    [entries, tripItems, trips],
  );
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  /**
   * Toute écriture : elle se voit tout de suite (en magasin, chaque seconde
   * compte), puis part au serveur ou en file. Appliquer d'avance est sans
   * danger : réappliquer la même opération ne double rien. Un refus du
   * serveur ramène l'écran à l'état d'avant et s'affiche.
   */
  async function write(change: CourseChange) {
    const op = stamp(change);
    let before: CourseData = EMPTY;
    setServer((current) => {
      before = current;
      return applyPending(current, [op]);
    });
    try {
      const result = await courseWriter.run(op);
      onError('');
      return result;
    } catch (err) {
      setServer(before);
      onError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      throw err;
    }
  }

  async function addItem(name: string, existing: Item | null) {
    // Déjà sur la liste (retapé, ou proposé par un autre chemin) : une
    // seule ligne par article, comme à la clôture d'une course.
    if (existing && entries.some((e) => e.itemId === existing.id)) return;
    const itemId = existing?.id ?? newId();
    if (!existing) await write({ kind: 'createItem', itemId, input: { name, aisle: guessAisle(name) } });
    await write({ kind: 'addEntry', entryId: newId(), itemId, quantity: existing?.defaultQuantity ?? '', note: '' });
  }

  async function patchEntry(entry: ListEntry, patch: ListEntryPatch) {
    await write({ kind: 'updateEntry', entryId: entry.id, patch }).catch(() => {});
  }

  async function saveEditor(entry: ListEntry, itemPatch: Partial<ItemInput>, entryPatch: ListEntryPatch) {
    await write({ kind: 'updateItem', itemId: entry.itemId, patch: itemPatch });
    await write({ kind: 'updateEntry', entryId: entry.id, patch: entryPatch });
    setEditing(null);
  }

  /**
   * Terminer la course : le plan (archivage, retrait, retour des habituels)
   * est calculé par `buildClosePlan` et appliqué d'un bloc par le stockage.
   * Un nouveau magasin est créé juste avant ; si la clôture échoue ensuite,
   * il existe déjà et sera simplement repris au nouvel essai.
   */
  async function closeTrip(form: CloseForm) {
    let store: { id: string; name: string } | null = form.store.existing;
    if (!store && form.store.name) {
      store = { id: newId(), name: form.store.name };
      await write({ kind: 'createStore', storeId: store.id, name: store.name });
    }
    const plan = buildClosePlan({
      items,
      entries,
      trips,
      day: form.day,
      store: { id: store?.id ?? null, name: store?.name ?? '' },
      totalCents: form.totalCents,
      note: form.note,
    });
    const sendToBudget = form.sendToBudget && expenses !== undefined;
    const result = await write({ kind: 'closeTrip', plan, budget: sendToBudget ? (form.accountId ? { accountId: form.accountId } : {}) : null });
    setClosing(false);
    const back = plan.addItemIds.length;
    if (result.status === 'queued' || !result.trip) {
      // Gardée sur le téléphone : la course (et sa dépense) partira au retour du réseau.
      setNotice(
        `Course gardée sur le téléphone : ${formatEuros(plan.trip.totalCents)}${store ? ` chez ${store.name}` : ''}. Elle partira${sendToBudget ? ', avec sa dépense au budget,' : ''} dès le retour du réseau.`,
      );
      return;
    }
    const trip = result.trip;
    let budget = '';
    if (sendToBudget && expenses) {
      // La course est enregistrée quoi qu'il arrive ; un échec ici se
      // rattrape depuis l'historique (« Ajouter au budget »), sans rien
      // ressaisir — la référence rend l'envoi rejouable sans doublon.
      try {
        await expenses.record({ ...expenseForTrip(trip), ...(form.accountId ? { accountId: form.accountId } : {}) });
        const paidWith = budgetAccounts.find((a) => a.id === form.accountId && !a.isDefault);
        budget = paidWith ? ` Ajoutée au budget, payée avec ${paidWith.name}.` : ' Ajoutée au budget.';
      } catch (err) {
        budget = ` Pas encore dans le budget (${err instanceof Error ? err.message : 'erreur'}) : réessaie depuis l’onglet Courses.`;
      }
    }
    setNotice(
      `Course enregistrée : ${formatEuros(plan.trip.totalCents)}${store ? ` chez ${store.name}` : ''}.` +
        (back > 0 ? ` ${back} habituel${back > 1 ? 's' : ''} remis sur la liste.` : '') +
        budget,
    );
    await refresh();
  }

  async function deleteTrip(trip: Trip) {
    try {
      // La dépense du budget d'abord : si elle échoue, la course reste là
      // et l'on peut réessayer ; dans l'autre ordre, la dépense resterait
      // orpheline, sans course pour la retirer.
      await expenses?.remove(tripRef(trip));
      await coursesStore.deleteTrip(trip.id);
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  }

  const editingItem = editing ? itemById.get(editing.itemId) : undefined;

  return (
    <div className="layout">
      <main className="main courses-main">
        <header className="topbar">
          <ModuleBrand label={label} emoji={emoji} onSwitchModule={onSwitchModule} />
          <div className="topbar-actions">
            <button
              className="btn btn-ghost btn-sm courses-topbar-btn"
              onClick={onOpenSettings}
              title="Réglages"
              aria-label="Réglages"
            >
              <span aria-hidden="true">⚙</span>
              <span className="courses-topbar-label">Réglages</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="notice error">
            {error}{' '}
            <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => void refresh()}>
              Réessayer
            </button>
          </div>
        )}

        {(offlineSince || pending.length > 0) && (
          <div className="notice courses-offline" role="status">
            {offlineSince ? (
              <>
                📴 <b>Hors ligne</b> — ta liste telle qu’elle était {clock(offlineSince)}. Ce que tu fais est gardé sur le
                téléphone
                {pending.length > 0 && ` (${pending.length} modification${pending.length > 1 ? 's' : ''} en attente)`} et partira
                au retour du réseau.
              </>
            ) : (
              <>
                ⏳ {pending.length} modification{pending.length > 1 ? 's' : ''} en attente d’envoi.{' '}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    void courseWriter.flush().then((r) => {
                      if (r.dropped.length > 0) onError(`Pas pu être enregistré : ${r.dropped.join(' ; ')}`);
                      if (r.sent > 0) void refresh();
                    })
                  }
                >
                  Envoyer
                </button>
              </>
            )}
          </div>
        )}

        <div className="courses-view-tabs" role="tablist" aria-label="Affichage">
          {(['list', 'trips', 'stats'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={`courses-view-tab${view === v ? ' on' : ''}`}
              onClick={() => {
                setView(v);
                setNotice('');
              }}
            >
              {v === 'list' ? 'Liste' : v === 'stats' ? 'Chiffres' : `Courses${trips.length > 0 ? ` (${trips.length})` : ''}`}
            </button>
          ))}
        </div>

        {notice && (
          <div className="notice info courses-notice" role="status">
            {notice}
          </div>
        )}

        {loading ? (
          <p>Chargement…</p>
        ) : view === 'stats' ? (
          <StatsView trips={trips} tripItems={tripItems} items={items} />
        ) : view === 'trips' ? (
          <TripsView trips={trips} tripItems={tripItems} onDelete={deleteTrip} expenses={expenses} onError={onError} />
        ) : (
          <>
            <AddItemBar items={items} entries={entries} nextTrip={nextTrip} onAdd={addItem} />

            {entries.length > 0 && (
              <section className="courses-summary" aria-label="Résumé de la liste">
                <span>
                  <b>{entries.length - inCart}</b> à prendre · <b>{inCart}</b> dans le panier
                </span>
                {inCart > 0 && (
                  <span className="courses-summary-basket">
                    Panier : <b>{formatEuros(basket.totalCents)}</b>
                    {basket.unpriced > 0 && ` (${basket.unpriced} sans prix)`}
                  </span>
                )}
                {inCart > 0 && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm courses-close-btn"
                    onClick={() => {
                      setNotice('');
                      setClosing(true);
                    }}
                  >
                    Terminer la course
                  </button>
                )}
                {estimate.known > 0 && (
                  <span className="courses-summary-estimate" title="D’après les derniers prix payés">
                    Reste à prendre : ≈ {formatEuros(estimate.totalCents)}
                    {estimate.unknown > 0 && ` (${estimate.unknown} sans prix connu)`}
                  </span>
                )}
              </section>
            )}

            {groups.length === 0 ? (
              <div className="empty courses-empty">
                <h3>La liste est vide</h3>
                <p>
                  Ajoute ce qu’il te faut ci-dessus. Marque les articles que tu rachètes souvent
                  comme habituels : ils reviendront d’eux-mêmes sur la liste.
                </p>
              </div>
            ) : (
              <div className="courses-aisles">
                {groups.map((group) => (
                  <section key={group.aisle} className="courses-aisle" aria-label={AISLE_LABELS[group.aisle]}>
                    <h2 className="courses-aisle-title">{AISLE_LABELS[group.aisle]}</h2>
                    <ul className="courses-lines">
                      {group.lines.map(({ entry, item }) => (
                        <ListLine
                          key={entry.id}
                          entry={entry}
                          item={item}
                          hintCents={lastPrice(item.id, tripItems, trips)?.priceCents ?? null}
                          onToggle={() => void patchEntry(entry, { checked: !entry.checked })}
                          onPrice={(priceCents) => void patchEntry(entry, { priceCents })}
                          onOpen={() => setEditing(entry)}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </>
        )}

        {closing && (
          <CloseTripDialog
            entries={entries}
            stores={stores}
            trips={trips}
            canSendToBudget={expenses !== undefined}
            accounts={budgetAccounts}
            onCancel={() => setClosing(false)}
            onConfirm={closeTrip}
          />
        )}

        {editing && editingItem && (
          <ItemEditor
            item={editingItem}
            entry={editing}
            onCancel={() => setEditing(null)}
            onSave={(itemPatch, entryPatch) => saveEditor(editing, itemPatch, entryPatch)}
            onRemoveFromList={async () => {
              await write({ kind: 'removeEntry', entryId: editing.id });
              setEditing(null);
            }}
            onDeleteItem={async () => {
              await write({ kind: 'deleteItem', itemId: editing.itemId });
              setEditing(null);
            }}
          />
        )}
      </main>
    </div>
  );
}
