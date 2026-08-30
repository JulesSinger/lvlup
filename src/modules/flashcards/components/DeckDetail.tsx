import { useCallback, useEffect, useMemo, useState } from 'react';
import { BoxDots } from './BoxDots';
import { BulkImport } from './BulkImport';
import { CardEditor } from './CardEditor';
import { ReviewSession } from './ReviewSession';
import { flashcardsStore } from '../data';
import { SESSION_LIMIT, boxDistribution, dueCards } from '../lib/boxes';
import { dayString } from '../lib/day';
import { BOX_COUNT } from '../lib/types';
import type { ParsedCard } from '../lib/bulkImport';
import type { Card, Deck } from '../lib/types';

interface Props {
  deck: Deck;
  onBack: () => void;
  onError: (message: string) => void;
}

/**
 * Le contenu d'un paquet — étapes 3, 5 et un fragment de 7
 * (docs/etude-flashcards.md §9) : créer, éditer, supprimer des cartes, une
 * par une ou en liste collée (`BulkImport`), et réviser celles qui sont
 * dues.
 *
 * Chaque carte annonce sa boîte (`BoxDots`), et un filtre par boîte permet
 * de voir ce que contient la boîte 1, la boîte 2, etc. — demande de Jules
 * après la V1 : « on ne sait pas quelle carte est bientôt finie ». C'est un
 * fragment de l'étape 6 (répartition par boîte) tiré en avant.
 */
export function DeckDetail({ deck, onBack, onError }: Props) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  /** `null` = fermé, `'new'` = création, une carte = édition. */
  const [editing, setEditing] = useState<Card | 'new' | null>(null);
  const [importingList, setImportingList] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  /** `null` = toutes les boîtes. */
  const [boxFilter, setBoxFilter] = useState<number | null>(null);

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

  const queue = useMemo(() => dueCards(cards, dayString()).slice(0, SESSION_LIMIT), [cards]);
  const distribution = useMemo(() => boxDistribution(cards), [cards]);
  const shown = boxFilter === null ? cards : cards.filter((c) => c.box === boxFilter);

  async function saveCard(input: { front: string; back: string }) {
    if (editing !== null && editing !== 'new') {
      await flashcardsStore.updateCard(editing.id, input);
    } else {
      await flashcardsStore.createCard({ deckId: deck.id, ...input });
      // Une carte neuve naît en boîte 1 : rester sur un autre filtre la rendrait invisible.
      setBoxFilter(null);
    }
    setEditing(null);
    await refresh();
  }

  async function importCards(fresh: ParsedCard[]) {
    await Promise.all(
      fresh.map((c) => flashcardsStore.createCard({ deckId: deck.id, front: c.front, back: c.back })),
    );
    // Comme une création à l'unité : les cartes importées naissent en boîte
    // 1, rester sur un autre filtre les rendrait invisibles.
    setBoxFilter(null);
    setImportingList(false);
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

  if (reviewing) {
    return (
      <ReviewSession
        title={deck.name}
        queue={queue}
        onDone={() => {
          setReviewing(false);
          void refresh();
        }}
        onError={onError}
      />
    );
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
        {queue.length > 0 && (
          <button className="btn btn-primary flashcards-review-start" onClick={() => setReviewing(true)}>
            Réviser ({queue.length})
          </button>
        )}
      </div>

      {loading ? (
        <p>Chargement…</p>
      ) : cards.length === 0 ? (
        <div className="empty">
          <h3>Aucune carte pour l'instant</h3>
          <p>Une carte porte un recto (la question) et un verso (la réponse).</p>
          <div className="flashcards-empty-actions">
            <button className="btn btn-primary" onClick={() => setEditing('new')}>
              Créer ma première carte
            </button>
            <button className="btn" onClick={() => setImportingList(true)}>
              Importer une liste
            </button>
          </div>
        </div>
      ) : (
        <div className="flashcards-cards">
          <div className="flashcards-box-filter" role="group" aria-label="Filtrer les cartes par boîte">
            <button
              className={`flashcards-box-chip${boxFilter === null ? ' on' : ''}`}
              aria-pressed={boxFilter === null}
              onClick={() => setBoxFilter(null)}
            >
              Toutes ({cards.length})
            </button>
            {Array.from({ length: BOX_COUNT }, (_, i) => i + 1).map((box) => (
              <button
                key={box}
                className={`flashcards-box-chip${boxFilter === box ? ' on' : ''}`}
                aria-pressed={boxFilter === box}
                title={`Ne montrer que la boîte ${box}`}
                onClick={() => setBoxFilter((f) => (f === box ? null : box))}
              >
                Boîte {box} ({distribution[box] ?? 0})
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="flashcards-box-empty">Aucune carte dans cette boîte.</p>
          ) : (
            <ul className="flashcards-list">
              {shown.map((card) => (
                <li key={card.id} className="flashcards-row flashcards-card-row">
                  <BoxDots box={card.box} />
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
          )}

          <div className="flashcards-cards-actions">
            <button className="btn btn-primary flashcards-add" onClick={() => setEditing('new')}>
              + Nouvelle carte
            </button>
            <button className="btn" onClick={() => setImportingList(true)}>
              Importer une liste
            </button>
          </div>
        </div>
      )}

      {editing !== null && (
        <CardEditor
          card={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={saveCard}
        />
      )}

      {importingList && (
        <BulkImport
          existingFronts={cards.map((c) => c.front)}
          onCancel={() => setImportingList(false)}
          onImport={importCards}
        />
      )}
    </div>
  );
}
