import { useEffect, useState } from 'react';
import { parsePositiveAmountToCents } from '../lib/amount';
import type { BudgetEnvelope, BudgetEnvelopeMoveInput } from '../lib/types';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  envelope: BudgetEnvelope;
  onCancel: () => void;
  onSave: (input: BudgetEnvelopeMoveInput) => Promise<void>;
}

/**
 * Affecter des fonds à une enveloppe, ou en retirer — un mouvement du
 * journal (docs/etude-astra-epargne.md §4.3). Le montant se tape toujours
 * positif ; c'est le bouton « Affecter »/« Retirer » qui porte le signe,
 * même motif que `EntryEditor` pour Dépense/Entrée.
 *
 * La note explique ce que représente un retrait quand il correspond à une
 * dépense réelle (§6 bis) — libre, jamais obligatoire : rien n'oblige à
 * documenter une simple réaffectation vers le non-affecté.
 */
export function EnvelopeMoveForm({ envelope, onCancel, onSave }: Props) {
  const [isWithdrawal, setIsWithdrawal] = useState(false);
  const [amountText, setAmountText] = useState('');
  const [day, setDay] = useState(today());
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  async function submit() {
    const positive = parsePositiveAmountToCents(amountText);
    if (positive === null || positive === 0) {
      setError('Le montant doit être un nombre supérieur à zéro (ex. 50).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        envelopeId: envelope.id,
        amountCents: isWithdrawal ? -positive : positive,
        day,
        note: note.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="modal budget-envelope-move-form"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">
            {envelope.emoji} {envelope.name}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>Mouvement</label>
            <div className="budget-kind-toggle" aria-label="Affecter ou retirer des fonds">
              <button
                type="button"
                aria-pressed={!isWithdrawal}
                className={`btn btn-sm${!isWithdrawal ? ' selected' : ''}`}
                onClick={() => setIsWithdrawal(false)}
              >
                + Affecter
              </button>
              <button
                type="button"
                aria-pressed={isWithdrawal}
                className={`btn btn-sm${isWithdrawal ? ' selected' : ''}`}
                onClick={() => setIsWithdrawal(true)}
              >
                − Retirer
              </button>
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label htmlFor="budget-envelope-move-amount">Montant (€)</label>
              <input
                id="budget-envelope-move-amount"
                type="text"
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="50"
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="budget-envelope-move-day">Jour</label>
              <input
                id="budget-envelope-move-day"
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="budget-envelope-move-note">Note (optionnelle)</label>
            <input
              id="budget-envelope-move-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Vidange + pneus, payée depuis le compte courant…"
            />
          </div>

          {error && <div className="notice error">{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
