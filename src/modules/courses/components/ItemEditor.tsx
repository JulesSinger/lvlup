import { useEffect, useState } from 'react';
import { recurrenceLabel, RECURRENCE_CHOICES } from '../lib/trip';
import { AISLE_LABELS, AISLES, type Aisle, type Item, type ItemInput, type ListEntry, type ListEntryPatch } from '../lib/types';

interface Props {
  item: Item;
  entry: ListEntry;
  onCancel: () => void;
  /** Rejette en cas d'échec : la fenêtre reste ouverte et remplie. */
  onSave: (item: Partial<ItemInput>, entry: ListEntryPatch) => Promise<void>;
  onRemoveFromList: () => Promise<void>;
  onDeleteItem: () => Promise<void>;
}

/**
 * Un article de la liste : ce qui vaut pour cette fois (quantité, note) et
 * ce qui vaut toujours (nom, rayon, récurrence, quantité habituelle).
 *
 * « Retirer de la liste » garde l'article au catalogue — un habituel
 * reviendra à son tour. « Supprimer l'article » l'efface du catalogue ;
 * les courses passées gardent son nom et son prix, figés.
 */
export function ItemEditor({ item, entry, onCancel, onSave, onRemoveFromList, onDeleteItem }: Props) {
  const [name, setName] = useState(item.name);
  const [aisle, setAisle] = useState<Aisle>(item.aisle);
  const [recurrence, setRecurrence] = useState<number | null>(item.recurrence);
  const [defaultQuantity, setDefaultQuantity] = useState(item.defaultQuantity);
  const [quantity, setQuantity] = useState(entry.quantity);
  const [note, setNote] = useState(entry.note);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  async function run(action: () => Promise<void>) {
    setSaving(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Le nom est obligatoire.');
      return;
    }
    void run(() =>
      onSave(
        { name: trimmed, aisle, recurrence, defaultQuantity: defaultQuantity.trim() },
        { quantity: quantity.trim(), note: note.trim() },
      ),
    );
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="modal courses-item-editor"
        role="dialog"
        aria-modal="true"
        aria-label={`Modifier « ${item.name} »`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">{item.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="courses-editor-caption">Pour cette course</p>
          <div className="courses-editor-grid">
            <div className="field">
              <label htmlFor="courses-quantity">Quantité</label>
              <input id="courses-quantity" type="text" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="2, 1 kg…" />
            </div>
            <div className="field">
              <label htmlFor="courses-note">Note</label>
              <input id="courses-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="bio, en promo…" />
            </div>
          </div>

          <p className="courses-editor-caption">Toujours</p>
          <div className="field">
            <label htmlFor="courses-name">Nom</label>
            <input id="courses-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="courses-editor-grid">
            <div className="field">
              <label htmlFor="courses-aisle">Rayon</label>
              <select id="courses-aisle" value={aisle} onChange={(e) => setAisle(e.target.value as Aisle)}>
                {AISLES.map((a) => (
                  <option key={a} value={a}>
                    {AISLE_LABELS[a]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="courses-recurrence">Revient</label>
              <select
                id="courses-recurrence"
                value={recurrence ?? ''}
                onChange={(e) => setRecurrence(e.target.value === '' ? null : Number(e.target.value))}
              >
                {RECURRENCE_CHOICES.map((r) => (
                  <option key={r ?? 'ponctuel'} value={r ?? ''}>
                    {recurrenceLabel(r)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {recurrence !== null && (
            <div className="field">
              <label htmlFor="courses-default-quantity">Quantité habituelle</label>
              <input
                id="courses-default-quantity"
                type="text"
                value={defaultQuantity}
                onChange={(e) => setDefaultQuantity(e.target.value)}
                placeholder="reprise quand l’article revient sur la liste"
              />
            </div>
          )}

          {error && <div className="notice error">{error}</div>}
        </div>

        <div className="modal-foot courses-editor-foot">
          <button className="btn btn-ghost btn-sm" onClick={() => void run(onRemoveFromList)} disabled={saving}>
            Retirer de la liste
          </button>
          <button
            className="btn btn-ghost btn-sm btn-danger"
            onClick={() => {
              if (window.confirm(`Supprimer « ${item.name} » de tes articles ? Les courses passées le gardent.`)) {
                void run(onDeleteItem);
              }
            }}
            disabled={saving}
          >
            Supprimer l’article
          </button>
          <span className="courses-editor-spacer" />
          <button className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
