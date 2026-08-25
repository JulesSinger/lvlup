import { useCallback, useEffect, useState } from 'react';
import { budgetStore } from '../data';
import { centsToInputValue, formatCents } from '../lib/amount';
import { computeEnvelopesOverview } from '../lib/envelopes';
import type { BudgetCategory, BudgetEntry, BudgetEnvelope, BudgetEnvelopeMove } from '../lib/types';
import { EnvelopeEditor } from './EnvelopeEditor';
import { EnvelopeHistory } from './EnvelopeHistory';
import { EnvelopeMoveForm } from './EnvelopeMoveForm';

/** Affiche un montant en euros sans forcer de signe « + » sur un montant positif ou nul. */
function formatAmount(cents: number): string {
  return cents < 0 ? formatCents(cents) : `${centsToInputValue(cents)} €`;
}

/**
 * L'écran des enveloppes d'épargne (docs/etude-astra-epargne.md, étape 2) :
 * le total mis de côté, réparti sur des enveloppes dynamiques, plus ce qui
 * reste non affecté. Le total ne vient que des écritures catégorisées
 * `epargne` (§3) ; le solde d'une enveloppe et le non-affecté ne sont
 * jamais stockés, toujours recalculés (§4.3) — voir `lib/envelopes.ts`.
 */
export function EnvelopesScreen({
  categories,
  onError,
  reloadToken,
}: {
  categories: BudgetCategory[];
  onError: (message: string) => void;
  reloadToken: number;
}) {
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [envelopes, setEnvelopes] = useState<BudgetEnvelope[]>([]);
  const [moves, setMoves] = useState<BudgetEnvelopeMove[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BudgetEnvelope | 'new' | null>(null);
  const [moving, setMoving] = useState<BudgetEnvelope | null>(null);
  const [viewingHistory, setViewingHistory] = useState<BudgetEnvelope | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextEntries, nextEnvelopes, nextMoves] = await Promise.all([
        budgetStore.listEntries(),
        budgetStore.listEnvelopes(),
        budgetStore.listEnvelopeMoves(),
      ]);
      setEntries(nextEntries);
      setEnvelopes(nextEnvelopes);
      setMoves(nextMoves);
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh, reloadToken]);

  async function saveEnvelope(input: { name: string; emoji?: string; color?: string }) {
    if (editing !== null && editing !== 'new') {
      await budgetStore.updateEnvelope(editing.id, input);
    } else {
      await budgetStore.createEnvelope(input);
    }
    setEditing(null);
    await refresh();
  }

  async function removeEnvelope(envelope: BudgetEnvelope) {
    if (
      !window.confirm(
        `Supprimer « ${envelope.name} » ? Ses fonds redeviendront non affectés, rien n'est perdu.`,
      )
    )
      return;
    try {
      await budgetStore.deleteEnvelope(envelope.id);
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  }

  async function saveMove(input: Parameters<typeof budgetStore.createEnvelopeMove>[0]) {
    await budgetStore.createEnvelopeMove(input);
    setMoving(null);
    await refresh();
  }

  if (loading) return <p>Chargement…</p>;

  const overview = computeEnvelopesOverview(entries, categories, envelopes, moves);

  return (
    <div className="budget-envelopes">
      <div className="budget-envelopes-total">
        <span className="budget-envelopes-total-label">Total mis de côté</span>
        <span className="budget-envelopes-total-amount">{formatAmount(overview.totalCents)}</span>
      </div>

      <div
        className={`budget-envelopes-unallocated${overview.unallocatedCents < 0 ? ' negative' : ''}`}
      >
        <span>Non affecté</span>
        <strong>{formatAmount(overview.unallocatedCents)}</strong>
      </div>

      {overview.unallocatedCents < 0 && (
        <div className="notice error">
          Le non affecté est négatif : tu as réparti plus que ce qui est réellement mis de côté.
          Retire des fonds d'une enveloppe pour rééquilibrer, ou vérifie le total.
        </div>
      )}

      {envelopes.length === 0 ? (
        <div className="empty">
          <h3>Aucune enveloppe pour l'instant</h3>
          <p>
            Une enveloppe donne un rôle à une partie de ton épargne — « Voiture », « Vacances »,
            « Épargne de précaution »… Le total ci-dessus reste non affecté tant que tu n'en as
            créé aucune.
          </p>
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            Créer ma première enveloppe
          </button>
        </div>
      ) : (
        <ul className="budget-list budget-envelope-list">
          {overview.balances.map(({ envelope, balanceCents }) => (
            <li key={envelope.id} className="budget-row budget-envelope-row">
              <span className="budget-row-swatch" style={{ background: envelope.color }} aria-hidden="true">
                {envelope.emoji}
              </span>
              <span className="budget-row-name">{envelope.name}</span>
              <span
                className={`budget-row-amount${balanceCents < 0 ? ' negative' : ' positive'}`}
              >
                {formatAmount(balanceCents)}
              </span>
              <span className="budget-row-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => setMoving(envelope)}>
                  Mouvement
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setViewingHistory(envelope)}>
                  Historique
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(envelope)}>
                  Modifier
                </button>
                <button
                  className="btn btn-ghost btn-sm btn-danger"
                  onClick={() => void removeEnvelope(envelope)}
                >
                  Supprimer
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {envelopes.length > 0 && (
        <button className="btn btn-primary budget-add" onClick={() => setEditing('new')}>
          + Nouvelle enveloppe
        </button>
      )}

      {editing !== null && (
        <EnvelopeEditor
          envelope={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={saveEnvelope}
        />
      )}

      {moving !== null && (
        <EnvelopeMoveForm envelope={moving} onCancel={() => setMoving(null)} onSave={saveMove} />
      )}

      {viewingHistory !== null && (
        <EnvelopeHistory
          envelope={viewingHistory}
          moves={moves}
          onCancel={() => setViewingHistory(null)}
          onError={onError}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
