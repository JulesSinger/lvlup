import { newId } from '../../../core/data/coreStore';
import { readRaw, writeRaw } from '../../../core/data/localSnapshot';
import { dayString } from '../lib/day';
import type { Card, CardInput, Deck, DeckInput } from '../lib/types';
import type { FlashcardsBackup, FlashcardsStore } from './flashcardsStore';

interface Snapshot extends FlashcardsBackup {}

/** Lecture des seules sections du module, sur le blob local partagé. */
function read(): Snapshot {
  const raw = readRaw();
  return {
    decks: Array.isArray(raw.flashcardsDecks) ? (raw.flashcardsDecks as Deck[]) : [],
    cards: Array.isArray(raw.flashcardsCards) ? (raw.flashcardsCards as Card[]) : [],
  };
}

/** Écriture par fusion : les sections des autres modules sont préservées. */
function write(snapshot: Snapshot) {
  writeRaw({
    ...readRaw(),
    flashcardsDecks: snapshot.decks,
    flashcardsCards: snapshot.cards,
  });
}

/** Flashcards (Orbite) stocké dans le navigateur, sans compte ni serveur. */
export class LocalFlashcards implements FlashcardsStore {
  async listDecks(): Promise<Deck[]> {
    return read().decks.slice().sort((a, b) => a.position - b.position);
  }

  async createDeck(input: DeckInput): Promise<Deck> {
    const snapshot = read();
    const deck: Deck = {
      id: newId(),
      name: input.name,
      emoji: input.emoji ?? '🪐',
      position: snapshot.decks.length,
      archived: false,
      createdAt: new Date().toISOString(),
    };
    snapshot.decks.push(deck);
    write(snapshot);
    return deck;
  }

  async updateDeck(id: string, patch: Partial<DeckInput> & { archived?: boolean }) {
    const snapshot = read();
    const deck = snapshot.decks.find((d) => d.id === id);
    if (!deck) return;
    Object.assign(deck, patch);
    write(snapshot);
  }

  async deleteDeck(id: string) {
    const snapshot = read();
    snapshot.decks = snapshot.decks.filter((d) => d.id !== id);
    // Un paquet supprimé emporte ses cartes — pas de carte orpheline sans
    // paquet pour l'accueillir (docs/etude-flashcards.md §6).
    snapshot.cards = snapshot.cards.filter((c) => c.deckId !== id);
    write(snapshot);
  }

  async listCards(): Promise<Card[]> {
    return read().cards.slice();
  }

  async createCard(input: CardInput): Promise<Card> {
    const snapshot = read();
    const card: Card = {
      id: newId(),
      deckId: input.deckId,
      front: input.front,
      back: input.back,
      // Une carte neuve naît en boîte 1, due aujourd'hui.
      box: 1,
      dueDay: dayString(),
      createdAt: new Date().toISOString(),
    };
    snapshot.cards.push(card);
    write(snapshot);
    return card;
  }

  async updateCard(id: string, patch: Partial<Pick<CardInput, 'front' | 'back'>>) {
    const snapshot = read();
    const card = snapshot.cards.find((c) => c.id === id);
    if (!card) return;
    // `box`/`dueDay` n'entrent pas dans `patch` : éditer une carte ne veut
    // jamais dire « je ne la savais pas », voir docs/etude-flashcards.md §6.
    if (patch.front !== undefined) card.front = patch.front;
    if (patch.back !== undefined) card.back = patch.back;
    write(snapshot);
  }

  async deleteCard(id: string) {
    const snapshot = read();
    snapshot.cards = snapshot.cards.filter((c) => c.id !== id);
    write(snapshot);
  }

  async exportData(): Promise<FlashcardsBackup> {
    const { decks, cards } = read();
    return { decks: decks.slice(), cards: cards.slice() };
  }

  async importData(data: FlashcardsBackup) {
    write({ decks: data.decks ?? [], cards: data.cards ?? [] });
  }
}
