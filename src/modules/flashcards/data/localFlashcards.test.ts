import { beforeEach, describe, expect, it } from 'vitest';
import { LocalFlashcards } from './localFlashcards';

/**
 * Le module s'appuie sur localStorage ; en environnement Node on en fournit
 * une version minimale plutôt que de tirer tout un DOM — même motif que
 * `modules/budget/data/localBudget.test.ts`.
 */
const memory = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
} as Storage;

describe('LocalFlashcards', () => {
  let store: LocalFlashcards;

  beforeEach(() => {
    memory.clear();
    store = new LocalFlashcards();
  });

  it('crée un paquet avec ses valeurs par défaut', async () => {
    const deck = await store.createDeck({ name: 'Vocabulaire espagnol' });
    expect(deck.emoji).toBe('🪐');
    expect(deck.archived).toBe(false);
    expect(deck.position).toBe(0);
    expect(await store.listDecks()).toEqual([deck]);
  });

  it('numérote les paquets dans leur ordre de création', async () => {
    await store.createDeck({ name: 'Espagnol' });
    await store.createDeck({ name: 'Anatomie' });
    const positions = (await store.listDecks()).map((d) => d.position);
    expect(positions).toEqual([0, 1]);
  });

  it('une carte neuve naît en boîte 1, due aujourd’hui', async () => {
    const deck = await store.createDeck({ name: 'Espagnol' });
    const card = await store.createCard({ deckId: deck.id, front: 'Hola', back: 'Bonjour' });
    expect(card.box).toBe(1);
    expect(card.dueDay).toBe(new Date().toISOString().slice(0, 10));
  });

  it('modifier une carte ne touche ni sa boîte ni son échéance', async () => {
    const deck = await store.createDeck({ name: 'Espagnol' });
    const card = await store.createCard({ deckId: deck.id, front: 'Hola', back: 'Bonjour' });
    await store.updateCard(card.id, { front: 'Hola,' });
    const [reread] = await store.listCards();
    expect(reread.front).toBe('Hola,');
    expect(reread.box).toBe(1);
    expect(reread.dueDay).toBe(card.dueDay);
  });

  it('supprimer un paquet emporte ses cartes', async () => {
    const deck = await store.createDeck({ name: 'Espagnol' });
    const autre = await store.createDeck({ name: 'Anatomie' });
    await store.createCard({ deckId: deck.id, front: 'Hola', back: 'Bonjour' });
    const gardee = await store.createCard({ deckId: autre.id, front: 'Fémur', back: 'Os de la cuisse' });

    await store.deleteDeck(deck.id);

    expect(await store.listDecks()).toEqual([autre]);
    expect(await store.listCards()).toEqual([gardee]);
  });

  it('réviser une carte écrit son état et journalise la révision', async () => {
    const deck = await store.createDeck({ name: 'Espagnol' });
    const card = await store.createCard({ deckId: deck.id, front: 'Hola', back: 'Bonjour' });

    await store.reviewCard(card.id, { box: 2, dueDay: '2026-09-01' }, true);

    const [reread] = await store.listCards();
    expect(reread.box).toBe(2);
    expect(reread.dueDay).toBe('2026-09-01');

    const [logged] = await store.listReviews();
    expect(logged.cardId).toBe(card.id);
    expect(logged.correct).toBe(true);
    expect(logged.boxAfter).toBe(2);
  });

  it('supprimer une carte emporte son journal', async () => {
    const deck = await store.createDeck({ name: 'Espagnol' });
    const card = await store.createCard({ deckId: deck.id, front: 'Hola', back: 'Bonjour' });
    await store.reviewCard(card.id, { box: 2, dueDay: '2026-09-01' }, true);

    await store.deleteCard(card.id);

    expect(await store.listReviews()).toEqual([]);
  });

  it('supprimer un paquet emporte le journal de ses cartes', async () => {
    const deck = await store.createDeck({ name: 'Espagnol' });
    const card = await store.createCard({ deckId: deck.id, front: 'Hola', back: 'Bonjour' });
    await store.reviewCard(card.id, { box: 2, dueDay: '2026-09-01' }, true);

    await store.deleteDeck(deck.id);

    expect(await store.listReviews()).toEqual([]);
  });

  it('exporte et réimporte fidèlement, journal compris', async () => {
    const deck = await store.createDeck({ name: 'Espagnol' });
    const card = await store.createCard({ deckId: deck.id, front: 'Hola', back: 'Bonjour' });
    await store.reviewCard(card.id, { box: 2, dueDay: '2026-09-01' }, true);

    const backup = await store.exportData();
    memory.clear();
    const restored = new LocalFlashcards();
    await restored.importData(backup);

    expect(await restored.listDecks()).toEqual(backup.decks);
    expect(await restored.listCards()).toEqual(backup.cards);
    expect(await restored.listReviews()).toEqual(backup.reviews);
  });
});
