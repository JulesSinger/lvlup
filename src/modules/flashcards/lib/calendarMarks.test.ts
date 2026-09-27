import { describe, expect, it } from 'vitest';
import { reviewMarks } from './calendarMarks';
import type { Card, Deck, Review } from './types';

const decks = [
  { id: 'en', name: 'Anglais', archived: false },
  { id: 'old', name: 'Ancien', archived: true },
] as Deck[];
const card = (id: string, deckId: string, dueDay: string) => ({ id, deckId, dueDay }) as Card;
const review = (day: string) => ({ id: `r${day}${Math.random()}`, cardId: 'x', day, correct: true, boxAfter: 2, createdAt: '' }) as Review;

describe('reviewMarks — le calque d’Orbite', () => {
  const today = '2026-09-27';

  it('les cartes en retard comptent aujourd’hui ; les paquets archivés ne comptent pas', () => {
    const marks = reviewMarks(decks, [card('a', 'en', '2026-09-20'), card('b', 'en', today), card('c', 'old', today)], [], '2026-09-21', '2026-10-04', today);
    expect(marks).toEqual([{ id: `due|${today}`, day: today, title: '2 cartes à réviser', detail: 'Anglais : 2' }]);
  });

  it('les jours à venir annoncent leurs cartes', () => {
    const marks = reviewMarks(decks, [card('a', 'en', '2026-10-01')], [], '2026-09-28', '2026-10-04', today);
    expect(marks.map((m) => [m.day, m.title])).toEqual([['2026-10-01', '1 carte à réviser']]);
  });

  it('les jours passés montrent ce qui a été révisé', () => {
    const marks = reviewMarks(decks, [], [review('2026-09-25'), review('2026-09-25'), review('2026-09-26')], '2026-09-21', '2026-09-27', today);
    expect(marks.map((m) => m.title)).toEqual(['✓ 2 cartes révisées', '✓ 1 carte révisée']);
  });
});
