import { useEffect, useState } from 'react';
import type { Card } from '../lib/types';

interface Props {
  card: Card | null;
  onCancel: () => void;
  onSave: (input: { front: string; back: string }) => Promise<void>;
}

/**
 * Créer ou éditer une carte : recto, verso — texte seul en V1 (voir
 * docs/etude-flashcards.md §3). Éditer ne touche jamais `box`/`dueDay` :
 * c'est `FlashcardsStore.updateCard` qui porte cette garantie, pas
 * l'éditeur (§6 de l'étude).
 */
export function CardEditor({ card, onCancel, onSave }: Props) {
  const isEdit = card !== null;
  const [front, setFront] = useState(card?.front ?? '');
  const [back, setBack] = useState(card?.back ?? '');
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
    const trimmedFront = front.trim();
    const trimmedBack = back.trim();
    if (!trimmedFront || !trimmedBack) {
      setError('Le recto et le verso sont tous les deux obligatoires.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ front: trimmedFront, back: trimmedBack });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="modal flashcards-card-editor"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">{isEdit ? 'Modifier la carte' : 'Nouvelle carte'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label htmlFor="flashcards-card-front">Recto — la question</label>
            <textarea
              id="flashcards-card-front"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="Hola"
              rows={3}
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="flashcards-card-back">Verso — la réponse</label>
            <textarea
              id="flashcards-card-back"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="Bonjour"
              rows={3}
            />
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
