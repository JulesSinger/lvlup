/**
 * Le calque d'Orbite dans le calendrier (Éclipse, docs/etude-calendrier.md
 * §6) — bibliothèque pure. Les jours passés montrent ce qui a été révisé ;
 * aujourd'hui et les jours à venir, ce qui sera à réviser, pour voir d'un
 * coup d'œil les jours chargés.
 */
import type { CalendarMark } from '../../../core/lib/services';
import type { Card, Deck, Review } from './types';

const cards = (n: number) => `${n} carte${n > 1 ? 's' : ''}`;

export function reviewMarks(
  decks: readonly Deck[],
  allCards: readonly Card[],
  reviews: readonly Review[],
  from: string,
  to: string,
  today: string,
): CalendarMark[] {
  const marks: CalendarMark[] = [];

  // Ce qui a été fait : le journal des révisions.
  const done = new Map<string, number>();
  for (const r of reviews) if (r.day >= from && r.day <= to && r.day <= today) done.set(r.day, (done.get(r.day) ?? 0) + 1);
  for (const [day, n] of done) marks.push({ id: `done|${day}`, day, title: `✓ ${cards(n)} révisée${n > 1 ? 's' : ''}` });

  // Ce qui est à faire : une carte en retard est à réviser aujourd'hui, pas un jour passé.
  const active = new Map(decks.filter((d) => !d.archived).map((d) => [d.id, d]));
  const due = new Map<string, Map<string, number>>();
  for (const card of allCards) {
    const deck = active.get(card.deckId);
    if (!deck) continue;
    const day = card.dueDay < today ? today : card.dueDay;
    if (day < from || day > to) continue;
    if (!due.has(day)) due.set(day, new Map());
    const byDeck = due.get(day)!;
    byDeck.set(deck.name, (byDeck.get(deck.name) ?? 0) + 1);
  }
  for (const [day, byDeck] of due) {
    const total = [...byDeck.values()].reduce((a, b) => a + b, 0);
    marks.push({
      id: `due|${day}`,
      day,
      title: `${cards(total)} à réviser`,
      detail: [...byDeck.entries()].map(([name, n]) => `${name} : ${n}`).join(', '),
    });
  }

  return marks.sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));
}
