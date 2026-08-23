import { useEffect, useState } from 'react';
import { centsToInputValue, parsePositiveAmountToCents } from '../lib/amount';
import type { BudgetCategory, BudgetEntry, BudgetEntryInput } from '../lib/types';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  entry: BudgetEntry | null;
  categories: BudgetCategory[];
  onCancel: () => void;
  onSave: (input: BudgetEntryInput) => Promise<void>;
}

/**
 * Ajout manuel — un formulaire court : jour, libellé, montant, catégorie
 * (docs/etude-astra.md §5). Le montant se tape toujours positif ; c'est le
 * bouton « Dépense »/« Entrée » qui porte le signe, pour ne jamais faire
 * deviner à l'utilisateur s'il doit taper un `-`.
 */
export function EntryEditor({ entry, categories, onCancel, onSave }: Props) {
  const isEdit = entry !== null;
  const [day, setDay] = useState(entry?.day ?? today());
  const [label, setLabel] = useState(entry?.label ?? '');
  const [isExpense, setIsExpense] = useState(entry ? entry.amountCents <= 0 : true);
  const [amountText, setAmountText] = useState(entry ? centsToInputValue(entry.amountCents) : '');
  const [categoryId, setCategoryId] = useState<string>(entry?.categoryId ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  async function submit() {
    if (!day) {
      setError('Le jour est obligatoire.');
      return;
    }
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError('Le libellé est obligatoire.');
      return;
    }
    const positive = parsePositiveAmountToCents(amountText);
    if (positive === null || positive === 0) {
      setError('Le montant doit être un nombre supérieur à zéro (ex. 12,50).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        day,
        label: trimmedLabel,
        amountCents: isExpense ? -positive : positive,
        categoryId: categoryId || null,
        source: 'manuelle',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="modal budget-entry-editor"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">{isEdit ? "Modifier l'écriture" : 'Nouvelle écriture'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="row">
            <div className="field">
              <label htmlFor="budget-entry-day">Jour</label>
              <input
                id="budget-entry-day"
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Type</label>
              {/* Deux boutons simples plutôt qu'un `role="radiogroup"` : la
                  bascule n'a que deux états et un bouton pressé se comprend
                  sans sémantique ARIA supplémentaire. */}
              <div className="budget-kind-toggle" aria-label="Dépense ou entrée">
                <button
                  type="button"
                  aria-pressed={isExpense}
                  className={`btn btn-sm${isExpense ? ' selected' : ''}`}
                  onClick={() => setIsExpense(true)}
                >
                  − Dépense
                </button>
                <button
                  type="button"
                  aria-pressed={!isExpense}
                  className={`btn btn-sm${!isExpense ? ' selected' : ''}`}
                  onClick={() => setIsExpense(false)}
                >
                  + Entrée
                </button>
              </div>
            </div>
          </div>

          <div className="field">
            <label htmlFor="budget-entry-label">Libellé</label>
            <input
              id="budget-entry-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Courses, restaurant, espèces…"
              autoFocus
            />
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="budget-entry-amount">Montant (€)</label>
              <input
                id="budget-entry-amount"
                type="text"
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="12,50"
              />
            </div>
            <div className="field">
              <label htmlFor="budget-entry-category">Catégorie</label>
              <select
                id="budget-entry-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">À classer</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <div className="notice error">{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
