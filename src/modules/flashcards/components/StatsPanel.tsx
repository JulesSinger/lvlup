import { useEffect } from 'react';
import { RECENT_DAYS } from '../lib/stats';
import type { ReviewStats } from '../lib/stats';

interface Props {
  stats: ReviewStats;
  onClose: () => void;
}

/**
 * Statistiques — étape 6 (docs/etude-flashcards.md §9), sans streak
 * (décision de Jules le 30/08/2026, §13) : le volume de révisions et le
 * taux de réussite, qui ont un sens quel que soit le remplissage de la
 * file du jour — contrairement à un streak, qui punirait un jour où
 * l'algorithme n'avait justement rien à proposer.
 */
export function StatsPanel({ stats, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal flashcards-stats" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">Statistiques</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {stats.total === 0 ? (
            <p className="flashcards-stats-empty">Pas encore de révision — reviens ici une fois lancé.</p>
          ) : (
            <div className="flashcards-stats-grid">
              <div className="flashcards-stat">
                <span className="flashcards-stat-value">{stats.total}</span>
                <span className="flashcards-stat-label">révisions au total</span>
              </div>
              <div className="flashcards-stat">
                <span className="flashcards-stat-value">{stats.recent}</span>
                <span className="flashcards-stat-label">sur les {RECENT_DAYS} derniers jours</span>
              </div>
              <div className="flashcards-stat">
                <span className="flashcards-stat-value">
                  {stats.successRate === null ? '—' : `${Math.round(stats.successRate * 100)} %`}
                </span>
                <span className="flashcards-stat-label">de réponses justes</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
