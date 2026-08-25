import { useEffect, useState } from 'react';
import type { BudgetCategory, BudgetCategoryInput, BudgetCategoryKind } from '../lib/types';
import { BUDGET_CATEGORY_KINDS } from '../lib/types';

const EMOJIS = [
  '🏠', '🧾', '⚡', '📶', '🛡️', '🔁', '🚌', '🛒', '🍽️', '🎉',
  '👕', '💊', '🔧', '🎁', '✈️', '🧩', '💼', '🏛️', '💳', '🏦',
  '🔄', '💶', '🐾', '📚', '💻', '👶', '🚗', '🎓', '🧸', '🌿',
];

const COLORS = [
  '#e0724c', '#e0a94c', '#4cb6a0', '#5aa9c9', '#6b8cae', '#8f8fd1',
  '#b98fd1', '#d16fa8', '#e05c8a', '#4cae5c', '#6fbf7f', '#a0a0a0',
];

const KIND_LABELS: Record<BudgetCategoryKind, string> = {
  fixe: 'Fixe — tombe tous les mois',
  variable: 'Variable — sur quoi on peut agir',
  revenu: 'Revenu — salaire, aides, remboursements',
  transfert: 'Transfert — exclu du camembert (virement à soi-même)',
  // Exclue du camembert comme « transfert », mais alimente en plus le total
  // suivi par les enveloppes d'épargne (docs/etude-astra-epargne.md §4.1).
  epargne: "Épargne — exclue du camembert, alimente le total des enveloppes",
};

interface Props {
  category: BudgetCategory | null;
  onCancel: () => void;
  onSave: (input: BudgetCategoryInput) => Promise<void>;
}

/** Créer ou éditer une catégorie : nom, emoji, couleur, nature. */
export function CategoryEditor({ category, onCancel, onSave }: Props) {
  const isEdit = category !== null;
  const [name, setName] = useState(category?.name ?? '');
  const [emoji, setEmoji] = useState(category?.emoji ?? EMOJIS[0]);
  const [color, setColor] = useState(category?.color ?? COLORS[0]);
  const [kind, setKind] = useState<BudgetCategoryKind>(category?.kind ?? 'variable');
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
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Le nom est obligatoire.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ name: trimmed, emoji, color, kind });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="modal budget-category-editor"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">{isEdit ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label htmlFor="budget-category-name">Nom</label>
            <input
              id="budget-category-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Courses, Loyer, Salaire…"
              autoFocus
            />
          </div>

          <div className="field">
            <label>Emoji</label>
            <div className="budget-emoji-grid" role="listbox" aria-label="Choisir un emoji">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  role="option"
                  aria-selected={e === emoji}
                  className={`budget-swatch-btn${e === emoji ? ' selected' : ''}`}
                  onClick={() => setEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Couleur</label>
            <div className="budget-color-grid" role="listbox" aria-label="Choisir une couleur">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="option"
                  aria-selected={c === color}
                  className={`budget-swatch-btn budget-color-swatch${c === color ? ' selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="budget-category-kind">Nature</label>
            <select
              id="budget-category-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as BudgetCategoryKind)}
            >
              {BUDGET_CATEGORY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
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
