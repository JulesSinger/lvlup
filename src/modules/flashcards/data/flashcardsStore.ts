import type { Card, CardInput, Deck, DeckInput } from '../lib/types';

/**
 * La part du module dans une sauvegarde. Le socle n'en connaît pas la
 * forme : il se contente d'assembler les sections que les modules lui
 * donnent (voir `core/data/backup.ts`).
 */
export interface FlashcardsBackup {
  decks: Deck[];
  cards: Card[];
}

/** Contrat de stockage du module flashcards (Orbite). */
export interface FlashcardsStore {
  listDecks(): Promise<Deck[]>;
  createDeck(input: DeckInput): Promise<Deck>;
  updateDeck(id: string, patch: Partial<DeckInput> & { archived?: boolean }): Promise<void>;
  /** Supprimer un paquet emporte ses cartes. */
  deleteDeck(id: string): Promise<void>;

  listCards(): Promise<Card[]>;
  createCard(input: CardInput): Promise<Card>;
  /** N'importe jamais `box`/`dueDay` : seule une révision les change (§9, étape 4-5). */
  updateCard(id: string, patch: Partial<Pick<CardInput, 'front' | 'back'>>): Promise<void>;
  deleteCard(id: string): Promise<void>;

  /** Sa section de la sauvegarde — le socle ne fait que l'assembler. */
  exportData(): Promise<FlashcardsBackup>;
  importData(data: FlashcardsBackup): Promise<void>;
}
