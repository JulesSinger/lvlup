import { describe, expect, it } from 'vitest';
import { computeStats } from './stats';
import type { Review } from './types';

let n = 0;

function review(patch: Partial<Review> = {}): Review {
  n += 1;
  return {
    id: `r${n}`,
    cardId: 'c1',
    day: '2026-08-30',
    correct: true,
    boxAfter: 2,
    createdAt: '2026-08-30T08:00:00.000Z',
    ...patch,
  };
}

describe('computeStats', () => {
  it('un journal vide donne des stats à zéro, sans taux de réussite', () => {
    expect(computeStats([], '2026-08-30')).toEqual({ total: 0, recent: 0, successRate: null });
  });

  it('compte le total, quelle que soit la date', () => {
    const reviews = [review({ day: '2026-01-01' }), review({ day: '2026-08-30' })];
    expect(computeStats(reviews, '2026-08-30').total).toBe(2);
  });

  it('« cette semaine » ne compte que les sept derniers jours, aujourd’hui compris', () => {
    const reviews = [
      review({ day: '2026-08-30' }), // aujourd'hui
      review({ day: '2026-08-24' }), // il y a 6 jours : dans la fenêtre
      review({ day: '2026-08-23' }), // il y a 7 jours : hors fenêtre
    ];
    expect(computeStats(reviews, '2026-08-30').recent).toBe(2);
  });

  it('le taux de réussite est la proportion de réponses justes', () => {
    const reviews = [
      review({ correct: true }),
      review({ correct: true }),
      review({ correct: false }),
      review({ correct: false }),
    ];
    expect(computeStats(reviews, '2026-08-30').successRate).toBe(0.5);
  });
});
