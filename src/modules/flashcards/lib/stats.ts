import { shiftDay } from './day';
import type { Review } from './types';

/**
 * Statistiques de révision — étape 6 (docs/etude-flashcards.md §9), sans
 * streak (décision de Jules le 30/08/2026 : la file du jour dépend de
 * l'algorithme, pas de la discipline de l'utilisateur — un jour sans rien
 * à réviser n'est pas un jour manqué, voir §13). Ce qui reste a du sens
 * quel que soit le remplissage de la file : le volume et la réussite.
 *
 * Bibliothèque pure, comme `lib/boxes.ts` : recalculée depuis le journal,
 * jamais stockée.
 */

/** Fenêtre de la statistique « cette semaine » — sept jours, aujourd'hui compris. */
export const RECENT_DAYS = 7;

export interface ReviewStats {
  total: number;
  /** Sur les `RECENT_DAYS` derniers jours, aujourd'hui compris. */
  recent: number;
  /** Proportion de réponses justes, `null` s'il n'y a encore aucune révision. */
  successRate: number | null;
}

export function computeStats(reviews: Review[], today: string): ReviewStats {
  const floor = shiftDay(today, -(RECENT_DAYS - 1));
  const recent = reviews.filter((r) => r.day >= floor && r.day <= today).length;
  const correct = reviews.filter((r) => r.correct).length;
  return {
    total: reviews.length,
    recent,
    successRate: reviews.length === 0 ? null : correct / reviews.length,
  };
}
