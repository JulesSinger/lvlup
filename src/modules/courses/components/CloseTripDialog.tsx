import { useEffect, useState } from 'react';
import { findStoreByName, storesByUse } from '../lib/catalog';
import { dayString } from '../lib/day';
import { centsToInput, formatEuros, parseEurosToCents } from '../lib/money';
import { suggestedTotal } from '../lib/trip';
import type { ListEntry, Store, Trip } from '../lib/types';

export interface CloseForm {
  day: string;
  /** Un magasin existant, ou le nom d'un nouveau (créé à l'enregistrement) */
  store: { existing: Store | null; name: string };
  totalCents: number;
  note: string;
  /** Ajouter la course comme dépense au budget (Astra), étape 6 */
  sendToBudget: boolean;
}

interface Props {
  entries: ListEntry[];
  stores: Store[];
  trips: Trip[];
  /** Le budget sait-il enregistrer une dépense ? (service du socle présent) */
  canSendToBudget: boolean;
  onCancel: () => void;
  /** Rejette en cas d'échec : la fenêtre reste ouverte et remplie. */
  onConfirm: (form: CloseForm) => Promise<void>;
}

/**
 * « Terminer la course » (étape 4, docs/etude-courses.md §12) : dire où et
 * combien, puis tout s'applique d'un bloc — les articles cochés partent
 * dans l'historique, les habituels reviennent sur la liste à leur tour, le
 * reste attend la prochaine fois.
 *
 * Le total est proposé comme la somme des prix saisis, mais **le ticket
 * fait foi** : une promotion au total, un article sans prix, et on corrige
 * ici sans tout ressaisir.
 */
export function CloseTripDialog({ entries, stores, trips, canSendToBudget, onCancel, onConfirm }: Props) {
  const ranked = storesByUse(stores, trips);
  const suggestion = suggestedTotal(entries);
  const [storeId, setStoreId] = useState<string | null>(ranked[0]?.id ?? null);
  const [newStore, setNewStore] = useState('');
  const [total, setTotal] = useState(suggestion.totalCents > 0 ? centsToInput(suggestion.totalCents) : '');
  const [day, setDay] = useState(dayString());
  const [note, setNote] = useState('');
  // Coché par défaut : c'est ce que Jules a demandé (26/09/2026). Décocher
  // sert le jour où le relevé bancaire a déjà amené ce paiement.
  const [sendToBudget, setSendToBudget] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const inCart = entries.filter((e) => e.checked).length;
  const left = entries.length - inCart;
  const totalCents = parseEurosToCents(total);

  async function submit() {
    if (totalCents === null) {
      setError('Indique le total payé, comme sur le ticket (par exemple 47,80).');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      setError('Choisis la date de la course.');
      return;
    }
    const typed = newStore.trim();
    const existing = typed ? findStoreByName(stores, typed) : (stores.find((s) => s.id === storeId) ?? null);
    setSaving(true);
    setError('');
    try {
      await onConfirm({
        day,
        store: { existing, name: existing?.name ?? typed },
        totalCents,
        note: note.trim(),
        sendToBudget: canSendToBudget && sendToBudget,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="modal courses-close-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Terminer la course"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">Terminer la course</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="courses-close-recap">
            <b>{inCart}</b> article{inCart > 1 ? 's' : ''} dans le panier
            {left > 0 && (
              <>
                {' '}
                · <b>{left}</b> reste{left > 1 ? 'nt' : ''} sur la liste pour la prochaine fois
              </>
            )}
          </p>

          <div className="field">
            <label>Magasin</label>
            {ranked.length > 0 && (
              <div className="courses-store-chips" role="radiogroup" aria-label="Magasins déjà utilisés">
                {ranked.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={!newStore.trim() && storeId === s.id}
                    className={`courses-store-chip${!newStore.trim() && storeId === s.id ? ' on' : ''}`}
                    onClick={() => {
                      setStoreId(s.id);
                      setNewStore('');
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            <input
              type="text"
              aria-label={ranked.length > 0 ? 'Autre magasin' : 'Magasin'}
              placeholder={ranked.length > 0 ? 'Autre magasin…' : 'Leclerc, Carrefour, le marché…'}
              value={newStore}
              onChange={(e) => setNewStore(e.target.value)}
            />
          </div>

          <div className="courses-editor-grid">
            <div className="field">
              <label htmlFor="courses-close-total">Total payé (€)</label>
              <input
                id="courses-close-total"
                type="text"
                inputMode="decimal"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                autoFocus
              />
              {suggestion.priced > 0 && (
                <span className="field-hint">
                  Somme des prix saisis : {formatEuros(suggestion.totalCents)}
                  {suggestion.unpriced > 0 && ` (${suggestion.unpriced} article${suggestion.unpriced > 1 ? 's' : ''} sans prix)`}
                  . Le ticket fait foi.
                </span>
              )}
            </div>
            <div className="field">
              <label htmlFor="courses-close-day">Date</label>
              <input id="courses-close-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="courses-close-note">Note (facultatif)</label>
            <input
              id="courses-close-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="promo, bon de réduction…"
            />
          </div>

          {canSendToBudget && (
            <label className="courses-budget-toggle">
              <input type="checkbox" checked={sendToBudget} onChange={(e) => setSendToBudget(e.target.checked)} />
              Ajouter la dépense au Budget (catégorie Courses)
            </label>
          )}

          {error && <div className="notice error">{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Terminer la course'}
          </button>
        </div>
      </div>
    </div>
  );
}
