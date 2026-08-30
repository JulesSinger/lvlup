import type { Card, CardInput, Deck, DeckInput, Review } from '../lib/types';

/**
 * La part du module dans une sauvegarde. Le socle n'en connaît pas la
 * forme : il se contente d'assembler les sections que les modules lui
 * donnent (voir `core/data/backup.ts`).
 */
export interface FlashcardsBackup {
  decks: Deck[];
  cards: Card[];
  reviews: Review[];
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
   * a le droit de changer `box`/`dueDay` (docs/etude-flashcards.md §6), et
   * qui journalise la révision (`Review`) pour les statistiques (étape 6).
   * Le nouvel état se calcule côté appelant avec `lib/boxes.ts#applyReview`,
   * jamais ici : ce contrat ne connaît pas la règle du Leitner, il ne fait
   * qu'écrire l'état qu'on lui donne — même séparation que `updateCategory`
   * qui ne recalcule jamais un solde. `correct` est fourni à part plutôt que
   * déduit de `patch.box === 1` : ce serait vrai aujourd'hui, mais seulement
   * parce que ce contrat en sait alors plus que ce qu'il devrait sur la
   * règle du Leitner.
   */
  reviewCard(id: string, patch: Pick<Card, 'box' | 'dueDay'>, correct: boolean): Promise<void>;

  /** Le journal des révisions passées — pour les statistiques, ne pilote rien. */
  listReviews(): Promise<Review[]>;

  /** Sa section de la sauvegarde — le socle ne fait que l'assembler. */
  exportData(): Promise<FlashcardsBackup>;
  importData(data: FlashcardsBackup): Promise<void>;
}
