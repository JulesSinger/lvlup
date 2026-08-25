import { useEffect } from 'react';
import { budgetStore } from '../data';
import { formatCents } from '../lib/amount';
import type { BudgetEnvelope, BudgetEnvelopeMove } from '../lib/types';

/**
 * L'historique des mouvements d'une enveloppe (étape 3, docs/etude-astra-
 * epargne.md §8) : voir, pas seulement le solde actuel, mais chaque
 * affectation et chaque retrait qui l'ont composé. Le plus récent en haut —
 * c'est celui qu'on vient de faire qu'on a le plus de chances de vouloir
 * vérifier ou corriger.
 */
export function EnvelopeHistory({
  envelope,
  moves,
  onCancel,
  onError,
  onChanged,
}: {
  envelope: BudgetEnvelope;
  moves: BudgetEnvelopeMove[];
  onCancel: () => void;
  onError: (message: string) => void;
  onChanged: () => Promise<void>;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const sorted = moves
    .filter((m) => m.envelopeId === envelope.id)
    .slice()
    .sort((a, b) => (a.day === b.day ? b.createdAt.localeCompare(a.createdAt) : b.day.localeCompare(a.day)));

  async function removeMove(move: BudgetEnvelopeMove) {
    if (!window.confirm(`Supprimer ce mouvement (${formatCents(move.amountCents)}) ?`)) return;
    try {
      await budgetStore.deleteEnvelopeMove(move.id);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="modal budget-envelope-history"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">
            {envelope.emoji} {envelope.name} — historique
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {sorted.length === 0 ? (
            <p className="budget-envelope-history-empty">Aucun mouvement pour l'instant.</p>
          ) : (
            <ul className="budget-list budget-envelope-history-list">
              {sorted.map((move) => (
                <li key={move.id} className="budget-row budget-envelope-history-row">
                  <span className="budget-row-day">{move.day}</span>
                  <span className="budget-row-name">
                    {move.note || (move.amountCents < 0 ? 'Retrait' : 'Affectation')}
                  </span>
                  <span
                    className={`budget-row-amount${move.amountCents < 0 ? ' negative' : ' positive'}`}
                  >
                    {formatCents(move.amountCents)}
                  </span>
                  <span className="budget-row-actions">
                    <button
                      className="btn btn-ghost btn-sm btn-danger"
                      onClick={() => void removeMove(move)}
                    >
                      Supprimer
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onCancel}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
