import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ModuleScreenProps } from '../../core/lib/module';
import { ModuleBrand } from '../../core/components/ModuleBrand';
import { AddItemBar } from './components/AddItemBar';
import { CloseTripDialog, type CloseForm } from './components/CloseTripDialog';
import { ItemEditor } from './components/ItemEditor';
import { ListLine } from './components/ListLine';
import { StatsView } from './components/StatsView';
import { TripsView } from './components/TripsView';
import { coursesStore } from './data';
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
  type Store,
  type Trip,
  type TripItem,
} from './lib/types';

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
 * Pas de mode hors ligne (décision du 25/09/2026) : une écriture qui échoue
 * est annulée à l'écran et l'erreur s'affiche, sans rien perdre de ce qui
 * était tapé.
 */
export function CoursesScreen({ error, onError, onOpenSettings, onSwitchModule, reloadToken, services, label, emoji }: ModuleScreenProps) {
  const expenses = services.expenses;
  const [items, setItems] = useState<Item[]>([]);
  const [entries, setEntries] = useState<ListEntry[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripItems, setTripItems] = useState<TripItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ListEntry | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  /** La liste, ou l'historique des courses (étape 4). */
  const [view, setView] = useState<'list' | 'trips' | 'stats'>('list');
  const [closing, setClosing] = useState(false);
  /** Le compte rendu de la dernière course terminée, jusqu'à la prochaine action. */
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [nextItems, nextEntries, nextTrips, nextTripItems, nextStores] = await Promise.all([
        coursesStore.listItems(),
        coursesStore.listEntries(),
        coursesStore.listTrips(),
        coursesStore.listTripItems(),
        coursesStore.listStores(),
      ]);
      setStores(nextStores);
      setItems(nextItems);
      setEntries(nextEntries);
      setTrips(nextTrips);
      setTripItems(nextTripItems);
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Au montage, et après une restauration de sauvegarde (reloadToken).
  useEffect(() => {
    void refresh();
  }, [refresh, reloadToken]);

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

  /** Une écriture qui échoue remonte au hub et est relancée à l'appelant. */
  async function guard<T>(action: () => Promise<T>, fallback: string): Promise<T> {
    try {
      return await action();
    } catch (err) {
      onError(err instanceof Error ? err.message : fallback);
      throw err;
    }
  }

  async function addItem(name: string, existing: Item | null) {
    // Déjà sur la liste (retapé, ou proposé par un autre chemin) : une
    // seule ligne par article, comme à la clôture d'une course.
    if (existing && entries.some((e) => e.itemId === existing.id)) return;
    await guard(async () => {
      const item = existing ?? (await coursesStore.createItem({ name, aisle: guessAisle(name) }));
      await coursesStore.addEntry(item.id, item.defaultQuantity);
    }, 'Ajout impossible.');
    await refresh();
  }

  /**
   * Cocher et noter un prix se voient tout de suite, sans attendre le
   * serveur — en magasin, chaque seconde compte. En cas d'échec, l'écran
   * revient à l'état d'avant et l'erreur s'affiche.
   */
  async function patchEntry(entry: ListEntry, patch: ListEntryPatch) {
    const before = entries;
    setEntries((list) => list.map((e) => (e.id === entry.id ? { ...e, ...patch } : e)));
    try {
      await coursesStore.updateEntry(entry.id, patch);
      onError('');
    } catch (err) {
      setEntries(before);
      onError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  }

  async function saveEditor(entry: ListEntry, itemPatch: Partial<ItemInput>, entryPatch: ListEntryPatch) {
    await coursesStore.updateItem(entry.itemId, itemPatch);
    await coursesStore.updateEntry(entry.id, entryPatch);
    setEditing(null);
    await refresh();
  }

  /**
   * Terminer la course : le plan (archivage, retrait, retour des habituels)
   * est calculé par `buildClosePlan` et appliqué d'un bloc par le stockage.
   * Un nouveau magasin est créé juste avant ; si la clôture échoue ensuite,
   * il existe déjà et sera simplement repris au nouvel essai.
   */
  async function closeTrip(form: CloseForm) {
    let store = form.store.existing;
    if (!store && form.store.name) store = await coursesStore.createStore(form.store.name);
    const plan = buildClosePlan({
      items,
      entries,
      trips,
      day: form.day,
      store: { id: store?.id ?? null, name: store?.name ?? '' },
      totalCents: form.totalCents,
      note: form.note,
    });
    const trip = await coursesStore.closeTrip(plan);
    setClosing(false);
    const back = plan.addItemIds.length;
    let budget = '';
    if (form.sendToBudget && expenses) {
      // La course est enregistrée quoi qu'il arrive ; un échec ici se
      // rattrape depuis l'historique (« Ajouter au budget »), sans rien
      // ressaisir — la référence rend l'envoi rejouable sans doublon.
      try {
        await expenses.record(expenseForTrip(trip));
        budget = ' Ajoutée au budget.';
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
              await coursesStore.removeEntry(editing.id);
              setEditing(null);
              await refresh();
            }}
            onDeleteItem={async () => {
              await coursesStore.deleteItem(editing.itemId);
              setEditing(null);
              await refresh();
            }}
          />
        )}
      </main>
    </div>
  );
}
