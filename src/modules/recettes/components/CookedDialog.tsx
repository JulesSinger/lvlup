import { useState } from 'react';
import type { CookedInput } from '../lib/types';
import { validateCooked } from '../lib/validation';
import { Modal } from './Modal';

/** « Je l'ai faite » : le jour, pour combien, une note sur 5, un mot pour la prochaine fois. */
export function CookedDialog({ recipeId, title, today, servings, onSave, onClose }: {
  recipeId: string;
  title: string;
  today: string;
  servings: number | null;
  onSave: (input: CookedInput) => Promise<void>;
  onClose: () => void;
}) {
  const [day, setDay] = useState(today);
  const [count, setCount] = useState(servings ? String(servings) : '');
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  async function save() {
    const input: CookedInput = { recipeId, day, servings: count.trim() ? Number(count) : null, rating, comment: comment.trim() };
    const problem = validateCooked(input);
    if (problem) return setError(problem);
    try {
      await onSave(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  }

  return (
    <Modal
      title={`Je l’ai faite — ${title}`}
      onClose={onClose}
      footer={
        <>
          <span className="recettes-spacer" />
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={() => void save()}>
            Enregistrer
          </button>
        </>
      }
    >
      <div className="recettes-field-row">
        <div className="field">
          <label htmlFor="recettes-cooked-day">Le</label>
          <input id="recettes-cooked-day" type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="recettes-cooked-servings">Pour (personnes)</label>
          <input id="recettes-cooked-servings" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <span className="recettes-label">Note</span>
        <div className="recettes-stars" role="group" aria-label="Note sur 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`recettes-star${rating !== null && n <= rating ? ' on' : ''}`}
              aria-label={`${n} sur 5`}
              aria-pressed={rating === n}
              onClick={() => setRating(rating === n ? null : n)}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="recettes-cooked-comment">Pour la prochaine fois</label>
        <input id="recettes-cooked-comment" value={comment} maxLength={1000} placeholder="Doubler l’ail, cuire 5 min de moins…" onChange={(e) => setComment(e.target.value)} />
      </div>
      {error && (
        <p className="recettes-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
