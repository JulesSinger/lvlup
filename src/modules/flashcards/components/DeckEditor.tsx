import { useEffect, useState } from 'react';
import type { Deck, DeckInput } from '../lib/types';

const EMOJIS = [
  '🪐', '📚', '🧠', '🔤', '🗣️', '🧮', '⚗️', '🧬', '🗺️', '🎵',
  '💻', '⚖️', '🏛️', '🩺', '🔬', '📐', '🌍', '🖌️', '♟️', '🍳',
];

interface Props {
  deck: Deck | null;
  onCancel: () => void;
  onSave: (input: DeckInput) => Promise<void>;
}

/** Créer ou éditer un paquet : nom et emoji. */
export function DeckEditor({ deck, onCancel, onSave }: Props) {
  const isEdit = deck !== null;
  const [name, setName] = useState(deck?.name ?? '');
  const [emoji, setEmoji] = useState(deck?.emoji ?? EMOJIS[0]);
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
      await onSave({ name: trimmed, emoji });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="modal flashcards-deck-editor"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">{isEdit ? 'Modifier le paquet' : 'Nouveau paquet'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label htmlFor="flashcards-deck-name">Nom</label>
            <input
              id="flashcards-deck-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vocabulaire espagnol, Anatomie…"
              autoFocus
            />
          </div>

          <div className="field">
            <label>Emoji</label>
            <div className="flashcards-emoji-grid" role="listbox" aria-label="Choisir un emoji">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  role="option"
                  aria-selected={e === emoji}
                  className={`flashcards-swatch-btn${e === emoji ? ' selected' : ''}`}
                  onClick={() => setEmoji(e)}
                >
                  {e}
                </button>
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
