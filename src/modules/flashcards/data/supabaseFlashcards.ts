import type { SupabaseClient } from '@supabase/supabase-js';
import { getClient, requireUserId, unwrap } from '../../../core/data/supabaseClient';
import { dayString } from '../lib/day';
import type { Card, CardInput, Deck, DeckInput, Review } from '../lib/types';
import type { FlashcardsBackup, FlashcardsStore } from './flashcardsStore';

interface DeckRow {
  id: string;
  name: string;
  emoji: string | null;
  position: number;
  archived: boolean;
  created_at: string;
}

interface CardRow {
  id: string;
  deck_id: string;
  front: string;
  back: string;
  box: number;
  due_day: string;
  created_at: string;
}

interface ReviewRow {
  id: string;
  card_id: string;
  day: string;
  correct: boolean;
  box_after: number;
  created_at: string;
}

function toDeck(row: DeckRow): Deck {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji ?? '🪐',
    position: row.position,
    archived: row.archived,
    createdAt: row.created_at,
  };
}

function toCard(row: CardRow): Card {
  return {
    id: row.id,
    deckId: row.deck_id,
    front: row.front,
    back: row.back,
    box: row.box,
    dueDay: row.due_day,
    createdAt: row.created_at,
  };
}

function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    cardId: row.card_id,
    day: row.day,
    correct: row.correct,
    boxAfter: row.box_after,
    createdAt: row.created_at,
  };
}

/** Flashcards (Orbite) stocké sur Supabase, protégé par le Row Level Security. */
export class SupabaseFlashcards implements FlashcardsStore {
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = getClient(url, anonKey);
  }

  private requireUserId(): Promise<string> {
    return requireUserId(this.client);
  }

  async listDecks(): Promise<Deck[]> {
    const rows = unwrap(
      await this.client.from('flashcards_decks').select('*').order('position', { ascending: true }),
    ) as DeckRow[];
    return rows.map(toDeck);
  }

  async createDeck(input: DeckInput): Promise<Deck> {
    const userId = await this.requireUserId();
    const { count } = await this.client
      .from('flashcards_decks')
      .select('id', { count: 'exact', head: true });
    const row = unwrap(
      await this.client
        .from('flashcards_decks')
        .insert({
          user_id: userId,
          name: input.name,
          emoji: input.emoji ?? '🪐',
          position: count ?? 0,
        })
        .select()
        .single(),
    ) as DeckRow;
    return toDeck(row);
  }

  async updateDeck(id: string, patch: Partial<DeckInput> & { archived?: boolean }) {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.emoji !== undefined) row.emoji = patch.emoji;
    if (patch.archived !== undefined) row.archived = patch.archived;
    const { error } = await this.client.from('flashcards_decks').update(row).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteDeck(id: string) {
    // `on delete cascade` sur `deck_id` retire ses cartes côté base.
    const { error } = await this.client.from('flashcards_decks').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async listCards(): Promise<Card[]> {
    const rows = unwrap(await this.client.from('flashcards_cards').select('*')) as CardRow[];
    return rows.map(toCard);
  }

  async createCard(input: CardInput): Promise<Card> {
    const userId = await this.requireUserId();
    const row = unwrap(
      await this.client
        .from('flashcards_cards')
        .insert({
          user_id: userId,
          deck_id: input.deckId,
          front: input.front,
          back: input.back,
          box: 1,
          due_day: dayString(),
        })
        .select()
        .single(),
    ) as CardRow;
    return toCard(row);
  }

  async updateCard(id: string, patch: Partial<Pick<CardInput, 'front' | 'back'>>) {
    const row: Record<string, unknown> = {};
    if (patch.front !== undefined) row.front = patch.front;
    if (patch.back !== undefined) row.back = patch.back;
    const { error } = await this.client.from('flashcards_cards').update(row).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteCard(id: string) {
    const { error } = await this.client.from('flashcards_cards').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async reviewCard(id: string, patch: Pick<Card, 'box' | 'dueDay'>, correct: boolean) {
    const userId = await this.requireUserId();
    const { error } = await this.client
      .from('flashcards_cards')
      .update({ box: patch.box, due_day: patch.dueDay })
      .eq('id', id);
    if (error) throw new Error(error.message);

    const { error: reviewError } = await this.client.from('flashcards_reviews').insert({
      user_id: userId,
      card_id: id,
      day: dayString(),
      correct,
      box_after: patch.box,
    });
    if (reviewError) throw new Error(reviewError.message);
  }

  async listReviews(): Promise<Review[]> {
    const rows = unwrap(await this.client.from('flashcards_reviews').select('*')) as ReviewRow[];
    return rows.map(toReview);
  }

  async exportData(): Promise<FlashcardsBackup> {
    return {
      decks: await this.listDecks(),
      cards: await this.listCards(),
      reviews: await this.listReviews(),
    };
  }

  /**
   * Remplace tout : plus simple et plus sûr qu'une fusion ligne à ligne,
   * cohérent avec le sens d'une restauration de sauvegarde. Paquets et
   * cartes changent d'id à l'import (Supabase les régénère) : on
   * reconstitue les correspondances avant de réinsérer ce qui en dépend —
   * les cartes après les paquets, le journal après les cartes.
   */
  async importData(data: FlashcardsBackup) {
    const userId = await this.requireUserId();
    await this.client.from('flashcards_reviews').delete().eq('user_id', userId);
    await this.client.from('flashcards_cards').delete().eq('user_id', userId);
    await this.client.from('flashcards_decks').delete().eq('user_id', userId);

    const deckIdMap = new Map<string, string>();
    for (const deck of data.decks ?? []) {
      const row = unwrap(
        await this.client
          .from('flashcards_decks')
          .insert({
            user_id: userId,
            name: deck.name,
            emoji: deck.emoji,
            position: deck.position,
            archived: deck.archived,
          })
          .select()
          .single(),
      ) as DeckRow;
      deckIdMap.set(deck.id, row.id);
    }

    const cardIdMap = new Map<string, string>();
    for (const card of data.cards ?? []) {
      const deckId = deckIdMap.get(card.deckId);
      if (!deckId) continue; // paquet disparu entre-temps : carte ignorée
      const row = unwrap(
        await this.client
          .from('flashcards_cards')
          .insert({
            user_id: userId,
            deck_id: deckId,
            front: card.front,
            back: card.back,
            box: card.box,
            due_day: card.dueDay,
          })
          .select()
          .single(),
      ) as CardRow;
      cardIdMap.set(card.id, row.id);
    }

    for (const review of data.reviews ?? []) {
      const cardId = cardIdMap.get(review.cardId);
      if (!cardId) continue; // carte disparue entre-temps : entrée de journal ignorée
      const { error } = await this.client.from('flashcards_reviews').insert({
        user_id: userId,
        card_id: cardId,
        day: review.day,
        correct: review.correct,
        box_after: review.boxAfter,
      });
      if (error) throw new Error(error.message);
    }
  }
}
