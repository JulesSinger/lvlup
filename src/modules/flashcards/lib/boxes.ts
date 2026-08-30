import { shiftDay } from './day';
import { BOX_COUNT } from './types';
import type { Card } from './types';

/**
 * Le moteur du système de Leitner — étape 4 (docs/etude-flashcards.md §9).
 *
 * Bibliothèque pure, sans état React ni appel réseau : toute la règle se
 * teste en lui passant des dates et des cartes, sans navigateur. L'écran de
 * révision (étape 5) ne fera qu'enchaîner `dueCards` puis `applyReview` —
 * aucune règle métier n'est écrite dans un composant.
 *
 * Décisions prises avec Jules le 30/08/2026 (docs/etude-flashcards.md §11) :
 * rétrogradation **dure** (une réponse fausse retombe toujours en boîte 1,
 * quelle que soit la boîte de départ — pas de descente d'un seul niveau), et
 * l'échelle d'intervalles ci-dessous.
 */

/**
 * Intervalle, en jours, avant qu'une carte redevienne due une fois entrée
 * dans cette boîte. Index 0 = boîte 1.
 */
export const BOX_INTERVALS: readonly number[] = [1, 2, 4, 8, 16];

/**
 * Une carte qui reste en boîte 5 après y être déjà arrivée ne suit plus
 * l'échelle de `BOX_INTERVALS` (qui s'arrêterait à 16, pour toujours) : elle
 * bascule sur cet intervalle plus long, borné (docs/etude-flashcards.md §6)
 * — une carte « maîtrisée » ne doit jamais sortir de la rotation pour de bon,
 * sous peine d'être oubliée sans que rien ne le signale.
 */
export const MASTERED_INTERVAL = 32;

/** Cartes dues aujourd'hui, dans l'ordre où les revoir. */
export function dueCards(cards: Card[], today: string): Card[] {
  return cards
    .filter((c) => c.dueDay <= today)
    .sort((a, b) => a.dueDay.localeCompare(b.dueDay) || a.box - b.box);
}

/**
 * Le nouvel état d'une carte après une réponse — pure, ne touche à rien.
 *
 * Une réponse fausse retombe toujours en boîte 1 : c'est la rétrogradation
 * « dure » du Leitner original, plus simple à expliquer et à tester qu'une
 * descente d'un seul niveau (docs/etude-flashcards.md §6).
 */
export function applyReview(
  card: Pick<Card, 'box' | 'dueDay'>,
  correct: boolean,
  today: string,
): Pick<Card, 'box' | 'dueDay'> {
  if (!correct) {
    return { box: 1, dueDay: shiftDay(today, BOX_INTERVALS[0]) };
  }
  if (card.box >= BOX_COUNT) {
    return { box: BOX_COUNT, dueDay: shiftDay(today, MASTERED_INTERVAL) };
  }
  const box = card.box + 1;
  return { box, dueDay: shiftDay(today, BOX_INTERVALS[box - 1]) };
}

/** Répartition des cartes d'un paquet par boîte — pour l'écran de statistiques (étape 6). */
export function boxDistribution(cards: Card[]): Record<number, number> {
  const tally: Record<number, number> = {};
  for (let box = 1; box <= BOX_COUNT; box++) tally[box] = 0;
  for (const card of cards) tally[card.box] = (tally[card.box] ?? 0) + 1;
  return tally;
}
