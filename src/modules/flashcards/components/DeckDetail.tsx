import { useCallback, useEffect, useState } from 'react';
import { CardEditor } from './CardEditor';
import { flashcardsStore } from '../data';
import type { Card, Deck } from '../lib/types';

interface Props {
  deck: Deck;
  onBack: () => void;
  onError: (message: string) => void;
}

/**
 * Le contenu d'un paquet — étape 3 (docs/etude-flashcards.md §9) : « le
 * contenu existe ». Créer, éditer, supprimer des cartes. Le moteur de
 * révision (quelles cartes sont dues, et où les envoie une réponse)
 * n'existe pas encore — étape 4 — donc aucune notion de boîte n'apparaît
 * encore à l'écran : une carte neuve est simplement listée.
 */
export function DeckDetail({ deck, onBack, onError }: Props) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  /** `null` = fermé, `'new'` = création, une carte = édition. */
  const [editing, setEditing] = useState<Card | 'new' | null>(null);

  const refresh = useCallback(async () => {
    try {
      const all = await flashcardsStore.listCards();
      setCards(all.filter((c) => c.deckId === deck.id));
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.id]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  async function saveCard(input: { front: string; back: string }) {
    if (editing !== null && editing !== 'new') {
      await flashcardsStore.updateCard(editing.id, input);
    } else {
      await flashcardsStore.createCard({ deckId: deck.id, ...input });
    }
    setEditing(null);
    await refresh();
  }

  async function removeCard(card: Card) {
    if (!window.confirm('Supprimer cette carte ?')) return;
    try {
      await flashcardsStore.deleteCard(card.id);
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  }

  return (
    <div className="flashcards-deck-detail">
      <div className="flashcards-deck-detail-head">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Paquets
        </button>
        <span className="flashcards-deck-detail-title">
          <span aria-hidden="true">{deck.emoji}</span> {deck.name}
        </span>
      </div>

      {loading ? (
        <p>Chargement…</p>
      ) : cards.length === 0 ? (
        <div className="empty">
          <h3>Aucune carte pour l'instant</h3>
          <p>Une carte porte un recto (la question) et un verso (la réponse).</p>
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            Créer ma première carte
          </button>
        </div>
      ) : (
        <div className="flashcards-cards">
          <ul className="flashcards-list">
            {cards.map((card) => (
              <li key={card.id} className="flashcards-row flashcards-card-row">
                <span className="flashcards-card-front">{card.front}</span>
                <span className="flashcards-card-back">{card.back}</span>
                <span className="flashcards-row-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(card)}>
                    Modifier
                  </button>
                  <button
                    className="btn btn-ghost btn-sm btn-danger"
                    onClick={() => void removeCard(card)}
                  >
                    Supprimer
                  </button>
                </span>
              </li>
            ))}
          </ul>

          <button className="btn btn-primary flashcards-add" onClick={() => setEditing('new')}>
            + Nouvelle carte
          </button>
        </div>
      )}

      {editing !== null && (
        <CardEditor
          card={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={saveCard}
        />
      )}
    </div>
  );
}
