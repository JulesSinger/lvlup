import { useState } from 'react';
import { flashcardsStore } from '../data';
import { applyReview } from '../lib/boxes';
import { dayString } from '../lib/day';
import type { Card, Deck } from '../lib/types';

interface Props {
  deck: Deck;
  /** La file du jour, déjà plafonnée (voir SESSION_LIMIT) — fixée à l'ouverture, elle ne grandit pas en cours de session. */
  queue: Card[];
  onDone: () => void;
  onError: (message: string) => void;
}

/**
 * L'écran de révision — étape 5 (docs/etude-flashcards.md §9) : « le module
 * devient utilisable seul, la V1 est atteinte ».
 *
 * Aucune règle métier ici : `applyReview` (lib/boxes.ts) décide du nouvel
 * état, cet écran ne fait qu'afficher une carte à la fois et enregistrer le
 * résultat via `flashcardsStore.reviewCard` — la seule méthode du contrat
 * qui a le droit de changer `box`/`dueDay` (`updateCard` ne le peut pas,
 * voir docs/etude-flashcards.md §6).
 */
export function ReviewSession({ deck, queue, onDone, onError }: Props) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [grading, setGrading] = useState(false);

  const current = queue[index];
  const done = index >= queue.length;

  async function grade(correct: boolean) {
    setGrading(true);
    try {
      const patch = applyReview(current, correct, dayString());
      await flashcardsStore.reviewCard(current.id, patch);
      setReviewed((r) => r + 1);
      setFlipped(false);
      setIndex((i) => i + 1);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally {
      setGrading(false);
    }
  }

  return (
    <div className="flashcards-review">
      <div className="flashcards-review-head">
        <button className="btn btn-ghost btn-sm" onClick={onDone}>
          ← {deck.name}
        </button>
        {!done && (
          <span className="flashcards-review-progress">
            {index + 1} / {queue.length}
          </span>
        )}
      </div>

      {done ? (
        <div className="empty">
          <h3>Session terminée</h3>
          <p>
            {reviewed} carte{reviewed > 1 ? 's' : ''} revue{reviewed > 1 ? 's' : ''}.
          </p>
          <button className="btn btn-primary" onClick={onDone}>
            Retour au paquet
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className={`flashcards-review-card${flipped ? ' flipped' : ''}`}
            onClick={() => setFlipped(true)}
            disabled={flipped}
          >
            <span className="flashcards-review-face">{flipped ? current.back : current.front}</span>
            {!flipped && <span className="flashcards-review-hint">Toucher pour retourner</span>}
          </button>

          {flipped && (
            <div className="flashcards-review-grade">
              <button className="btn btn-danger" disabled={grading} onClick={() => void grade(false)}>
                Faux
              </button>
              <button className="btn btn-primary" disabled={grading} onClick={() => void grade(true)}>
                Juste
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
