import type { CalendarSource } from '../../../core/lib/services';
import { reviewMarks } from '../lib/calendarMarks';
import { dayString } from '../lib/day';
import type { FlashcardsStore } from './flashcardsStore';

/** Le calque d'Orbite que le calendrier affiche (`core/lib/services.ts`). */
export function createCalendarSource(store: FlashcardsStore): CalendarSource {
  return {
    id: 'flashcards',
    label: 'Flashcards',
    color: '#52d6c8',
    defaultVisible: true,
    async marksBetween(from, to) {
      const [decks, cards, reviews] = await Promise.all([store.listDecks(), store.listCards(), store.listReviews()]);
      return reviewMarks(decks, cards, reviews, from, to, dayString());
    },
  };
}
