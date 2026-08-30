import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ModuleScreenProps } from '../../core/lib/module';
import { DeckEditor } from './components/DeckEditor';
import { flashcardsStore } from './data';
import type { Deck, DeckInput } from './lib/types';

/**
 * Écran racine d'Orbite — étape 2 (docs/etude-flashcards.md §9) : gérer les
 * paquets. Les cartes, le moteur de révision et les statistiques arrivent
 * aux étapes suivantes ; cet écran est donc, pour l'instant, tout ce
 * qu'Orbite sait faire.
 */
export function FlashcardsScreen({
  error,
  onError,
  onOpenSettings,
  onBackToHub,
  reloadToken,
}: ModuleScreenProps) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  /** `null` = fermé, `'new'` = création, un paquet = édition. */
  const [editing, setEditing] = useState<Deck | 'new' | null>(null);

  const refresh = useCallback(async () => {
    try {
      setDecks(await flashcardsStore.listDecks());
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

        {loading ? (
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
            {activeDecks.length > 0 && (
              <ul className="flashcards-list">
                {activeDecks.map((deck) => (
                  <li key={deck.id} className="flashcards-row">
                    <span className="flashcards-row-swatch" aria-hidden="true">
                      {deck.emoji}
                    </span>
                    <span className="flashcards-row-name">{deck.name}</span>
                    <span className="flashcards-row-actions">
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
      </main>
    </div>
  );
}
