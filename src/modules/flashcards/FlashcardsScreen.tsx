import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ModuleScreenProps } from '../../core/lib/module';
import { BoxDots } from './components/BoxDots';
import { DeckDetail } from './components/DeckDetail';
import { DeckEditor } from './components/DeckEditor';
import { ReviewSession } from './components/ReviewSession';
import { StatsPanel } from './components/StatsPanel';
import { flashcardsStore } from './data';
import { SESSION_LIMIT, boxDistribution, dueCards } from './lib/boxes';
import { dayString } from './lib/day';
import { computeStats } from './lib/stats';
import { BOX_COUNT } from './lib/types';
import type { Card, Deck, DeckInput, Review } from './lib/types';

/**
 * Écran racine d'Orbite — étapes 2, 3, 5 et une partie de 6
 * (docs/etude-flashcards.md §9), plus des demandes de Jules après la V1 :
 * savoir tout de suite ce qu'il y a à réviser aujourd'hui (bandeau
 * « Aujourd'hui », pastille par paquet), voir la répartition par boîte
 * tous paquets confondus (§13), et des statistiques de volume/réussite
 * sans streak (§13 — la file du jour dépend de l'algorithme, pas de la
 * discipline de l'utilisateur, un streak punirait un jour sans rien à
 * réviser).
 */
export function FlashcardsScreen({
  error,
  onError,
  onOpenSettings,
  onBackToHub,
  reloadToken,
}: ModuleScreenProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  /** `null` = fermé, `'new'` = création, un paquet = édition. */
  const [editing, setEditing] = useState<Deck | 'new' | null>(null);
  /** Le paquet dont on regarde le contenu, `null` = liste des paquets. */
  const [openDeck, setOpenDeck] = useState<Deck | null>(null);
  /** Session « Aujourd'hui », tous paquets confondus. */
  const [reviewingToday, setReviewingToday] = useState(false);
  /** Boîte affichée dans la liste globale, `null` = repliée. */
  const [boxFilter, setBoxFilter] = useState<number | null>(null);
  const [showStats, setShowStats] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [nextDecks, nextCards, nextReviews] = await Promise.all([
        flashcardsStore.listDecks(),
        flashcardsStore.listCards(),
        flashcardsStore.listReviews(),
      ]);
      setDecks(nextDecks);
      setCards(nextCards);
      setReviews(nextReviews);
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Au montage, et après une restauration de sauvegarde (reloadToken) : le
  // hub ne sait pas relire les données d'un module, c'est à lui de le faire.
  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh, reloadToken]);

  const activeDecks = useMemo(() => decks.filter((d) => !d.archived), [decks]);
  const archivedDecks = useMemo(() => decks.filter((d) => d.archived), [decks]);

  // Un paquet archivé ne réclame rien : ses cartes restent en l'état,
  // aucune session n'y pioche tant qu'il n'est pas restauré.
  const reviewableCards = useMemo(() => {
    const activeIds = new Set(activeDecks.map((d) => d.id));
    return cards.filter((c) => activeIds.has(c.deckId));
  }, [cards, activeDecks]);

  const dueToday = useMemo(
    () => dueCards(reviewableCards, dayString()),
    [reviewableCards],
  );

  const dueByDeck = useMemo(() => {
    const tally = new Map<string, number>();
    for (const card of dueToday) tally.set(card.deckId, (tally.get(card.deckId) ?? 0) + 1);
    return tally;
  }, [dueToday]);

  const deckById = useMemo(() => new Map(activeDecks.map((d) => [d.id, d])), [activeDecks]);
  const globalDistribution = useMemo(() => boxDistribution(reviewableCards), [reviewableCards]);
  const boxFilteredCards = useMemo(
    () => (boxFilter === null ? [] : reviewableCards.filter((c) => c.box === boxFilter)),
    [reviewableCards, boxFilter],
  );

  const stats = useMemo(() => computeStats(reviews, dayString()), [reviews]);

  async function saveDeck(input: DeckInput) {
    if (editing !== null && editing !== 'new') {
      await flashcardsStore.updateDeck(editing.id, input);
    } else {
      await flashcardsStore.createDeck(input);
    }
    setEditing(null);
    await refresh();
  }

  function archiveDeck(deck: Deck) {
    void flashcardsStore.updateDeck(deck.id, { archived: true }).then(refresh);
  }

  function restoreDeck(deck: Deck) {
    void flashcardsStore.updateDeck(deck.id, { archived: false }).then(refresh);
  }

  async function removeDeck(deck: Deck) {
    if (!window.confirm(`Supprimer « ${deck.name} » ? Ses cartes seront perdues.`)) return;
    try {
      await flashcardsStore.deleteDeck(deck.id);
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  }

  return (
    <div className="layout">
      <main className="main">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">🪐</span>
            <span className="brand-name">Orbite</span>
          </div>
          <div className="topbar-actions">
            <button className="btn btn-ghost btn-sm" onClick={onBackToHub}>
              ← Modules
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowStats(true)}>
              📊 Statistiques
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onOpenSettings}>
              ⚙ Réglages
            </button>
          </div>
        </header>

        {error && (
          <div className="notice error">
            {error}{' '}
            <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => void refresh()}>
              Réessayer
            </button>
          </div>
        )}

        {reviewingToday ? (
          <ReviewSession
            title="Aujourd'hui"
            queue={dueToday.slice(0, SESSION_LIMIT)}
            decks={activeDecks}
            onDone={() => {
              setReviewingToday(false);
              void refresh();
            }}
            onError={onError}
          />
        ) : openDeck ? (
          <DeckDetail
            deck={openDeck}
            onBack={() => {
              setOpenDeck(null);
              // Réviser, ajouter ou supprimer une carte dans le paquet a pu
              // changer ce que l'écran principal affiche (bandeau du jour,
              // pastilles, répartition par boîte, statistiques) — sans ce
              // rafraîchissement, tout restait figé sur l'état d'avant
              // l'ouverture du paquet.
              void refresh();
            }}
            onError={onError}
          />
        ) : loading ? (
          <p>Chargement…</p>
        ) : activeDecks.length === 0 && archivedDecks.length === 0 ? (
          <div className="empty">
            <h3>Aucun paquet pour l'instant</h3>
            <p>
              Un paquet range les cartes d'un même sujet — une langue, un cours. Crée-en un pour
              commencer.
            </p>
            <button className="btn btn-primary" onClick={() => setEditing('new')}>
              Créer mon premier paquet
            </button>
          </div>
        ) : (
          <div className="flashcards-decks">
            {dueToday.length > 0 ? (
              <div className="flashcards-today">
                <span className="flashcards-today-text">
                  <b>{dueToday.length}</b> carte{dueToday.length > 1 ? 's' : ''} à réviser aujourd'hui
                </span>
                <button className="btn btn-primary" onClick={() => setReviewingToday(true)}>
                  Réviser
                </button>
              </div>
            ) : (
              <div className="flashcards-today flashcards-today-empty">
                <span className="flashcards-today-text">Tout est à jour, rien à réviser aujourd'hui.</span>
              </div>
            )}

            {activeDecks.length > 0 && (
              <div className="flashcards-box-filter" role="group" aria-label="Filtrer les cartes par boîte">
                <button
                  className={`flashcards-box-chip${boxFilter === null ? ' on' : ''}`}
                  aria-pressed={boxFilter === null}
                  onClick={() => setBoxFilter(null)}
                >
                  Toutes ({reviewableCards.length})
                </button>
                {Array.from({ length: BOX_COUNT }, (_, i) => i + 1).map((box) => (
                  <button
                    key={box}
                    className={`flashcards-box-chip${boxFilter === box ? ' on' : ''}`}
                    aria-pressed={boxFilter === box}
                    title={`Ne montrer que la boîte ${box}, tous paquets confondus`}
                    onClick={() => setBoxFilter((f) => (f === box ? null : box))}
                  >
                    Boîte {box} ({globalDistribution[box] ?? 0})
                  </button>
                ))}
              </div>
            )}

            {boxFilter !== null &&
              (boxFilteredCards.length === 0 ? (
                <p className="flashcards-box-empty">Aucune carte dans cette boîte.</p>
              ) : (
                <ul className="flashcards-list">
                  {boxFilteredCards.map((card) => {
                    const owner = deckById.get(card.deckId);
                    return (
                      <li
                        key={card.id}
                        className="flashcards-row flashcards-row-clickable"
                        onClick={() => owner && setOpenDeck(owner)}
                      >
                        <BoxDots box={card.box} />
                        <span className="flashcards-row-name">{card.front}</span>
                        {owner && (
                          <span className="flashcards-row-deck">
                            {owner.emoji} {owner.name}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ))}

            {activeDecks.length > 0 && (
              <ul className="flashcards-list">
                {activeDecks.map((deck) => (
                  <li
                    key={deck.id}
                    className="flashcards-row flashcards-row-clickable"
                    onClick={() => setOpenDeck(deck)}
                  >
                    <span className="flashcards-row-swatch" aria-hidden="true">
                      {deck.emoji}
                    </span>
                    <span className="flashcards-row-name">{deck.name}</span>
                    {(dueByDeck.get(deck.id) ?? 0) > 0 && (
                      <span className="flashcards-row-due" title="Cartes dues aujourd'hui">
                        {dueByDeck.get(deck.id)}
                      </span>
                    )}
                    <span className="flashcards-row-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(deck)}>
                        Modifier
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => archiveDeck(deck)}>
                        Archiver
                      </button>
                      <button
                        className="btn btn-ghost btn-sm btn-danger"
                        onClick={() => void removeDeck(deck)}
                      >
                        Supprimer
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <button className="btn btn-primary flashcards-add" onClick={() => setEditing('new')}>
              + Nouveau paquet
            </button>

            {archivedDecks.length > 0 && (
              <section className="flashcards-archived">
                <h2 className="flashcards-archived-title">Archivés ({archivedDecks.length})</h2>
                {archivedDecks.map((deck) => (
                  <div key={deck.id} className="flashcards-archived-row">
                    <span className="flashcards-archived-emoji" aria-hidden="true">
                      {deck.emoji}
                    </span>
                    <span className="flashcards-archived-name">{deck.name}</span>
                    <button className="btn btn-sm" onClick={() => restoreDeck(deck)}>
                      Restaurer
                    </button>
                    <button
                      className="btn btn-ghost btn-sm btn-danger"
                      onClick={() => void removeDeck(deck)}
                      title="Supprimer définitivement"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}

        {editing !== null && (
          <DeckEditor
            deck={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSave={saveDeck}
          />
        )}

        {showStats && <StatsPanel stats={stats} onClose={() => setShowStats(false)} />}
      </main>
    </div>
  );
}
