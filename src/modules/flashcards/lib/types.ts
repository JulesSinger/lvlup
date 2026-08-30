/**
 * Types du module flashcards (Orbite). Conception complète : docs/etude-flashcards.md.
 */

/**
 * Nombre de boîtes du système de Leitner — décision prise avec Jules le
 * 30/08/2026 (docs/etude-flashcards.md §11). `box` sur une carte vaut donc
 * un entier entre 1 et `BOX_COUNT` ; `lib/schema.test.ts` compare cette
 * constante à la contrainte `flashcards_cards_box_check` de la migration,
 * même discipline que `TIER_KINDS` (modules/objectifs/lib/types.ts).
 */
export const BOX_COUNT = 5;

/** Un paquet — le conteneur nommé, même rôle qu'un objectif pour Zénith. */
export interface Deck {
  id: string;
  name: string;
  emoji: string;
  /** Position d'affichage, 0 = premier */
  position: number;
  archived: boolean;
  createdAt: string;
}

export interface DeckInput {
  name: string;
  emoji?: string;
}

/**
 * Une carte : un recto, un verso, et son état dans le système de Leitner.
 *
 * `box` et `dueDay` sont stockés directement, pas recalculés depuis un
 * historique de révisions (docs/etude-flashcards.md §4) : le système est
 * fondamentalement à état, la boîte EST l'état de la carte. Une carte neuve
 * naît en boîte 1, due aujourd'hui — elle est donc revue dès la première
 * session.
 */
export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  /** 1 à `BOX_COUNT` */
  box: number;
  /** Jour local (YYYY-MM-DD) à partir duquel la carte redevient due */
  dueDay: string;
  createdAt: string;
}

export interface CardInput {
  deckId: string;
  front: string;
  back: string;
}
