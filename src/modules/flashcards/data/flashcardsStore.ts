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
  /** N'importe jamais `box`/`dueDay` : seule une révision les change, via `reviewCard`. */
  updateCard(id: string, patch: Partial<Pick<CardInput, 'front' | 'back'>>): Promise<void>;
  deleteCard(id: string): Promise<void>;

  /**
   * Enregistre le résultat d'une révision — la seule méthode du contrat qui
   * a le droit de changer `box`/`dueDay` (docs/etude-flashcards.md §6). Le
   * nouvel état se calcule côté appelant avec `lib/boxes.ts#applyReview`,
   * jamais ici : ce contrat ne connaît pas la règle du Leitner, il ne fait
   * qu'écrire l'état qu'on lui donne — même séparation que `updateCategory`
   * qui ne recalcule jamais un solde.
   */
  reviewCard(id: string, patch: Pick<Card, 'box' | 'dueDay'>): Promise<void>;

  /** Sa section de la sauvegarde — le socle ne fait que l'assembler. */
  exportData(): Promise<FlashcardsBackup>;
  importData(data: FlashcardsBackup): Promise<void>;
}
