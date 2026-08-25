import { useEffect, useState } from 'react';
import type { BudgetEnvelope, BudgetEnvelopeInput } from '../lib/types';

const EMOJIS = [
  '🚗', '✈️', '🏖️', '🏦', '🎓', '🧸', '🎁', '💍', '🏠', '🧑‍⚕️',
  '🐾', '📚', '💻', '👶', '🌿', '🛡️', '🔧', '🎉', '💶', '⭐',
];

const COLORS = [
  '#e0724c', '#e0a94c', '#4cb6a0', '#5aa9c9', '#6b8cae', '#8f8fd1',
  '#b98fd1', '#d16fa8', '#e05c8a', '#4cae5c', '#6fbf7f', '#a0a0a0',
];

interface Props {
  envelope: BudgetEnvelope | null;
  onCancel: () => void;
  onSave: (input: BudgetEnvelopeInput) => Promise<void>;
}

/**
 * Créer ou renommer une enveloppe : nom, emoji, couleur — pas de nature à
 * choisir, contrairement à une catégorie (docs/etude-astra-epargne.md §4.2).
 */
export function EnvelopeEditor({ envelope, onCancel, onSave }: Props) {
  const isEdit = envelope !== null;
  const [name, setName] = useState(envelope?.name ?? '');
  const [emoji, setEmoji] = useState(envelope?.emoji ?? EMOJIS[0]);
  const [color, setColor] = useState(envelope?.color ?? COLORS[0]);
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
      await onSave({ name: trimmed, emoji, color });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="modal budget-envelope-editor"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">{isEdit ? "Modifier l'enveloppe" : 'Nouvelle enveloppe'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label htmlFor="budget-envelope-name">Nom</label>
            <input
              id="budget-envelope-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Voiture, Vacances, Épargne de précaution…"
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
