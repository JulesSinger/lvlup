import { useState } from 'react';
import { centsToInput, parseEuros } from '../lib/money';
import { validatePayment } from '../lib/payments';
import type { Payment } from '../lib/types';
import { Modal } from './Modal';
import { useSaving } from './useSaving';

export interface PaymentDraft {
  label: string;
  amountCents: number;
  expectedDay: string | null;
}

interface Props {
  /** `null` : un nouveau paiement */
  payment: Payment | null;
  onClose: () => void;
  onSave: (draft: PaymentDraft) => Promise<void>;
  /** Pour un paiement reçu : revenir à « attendu » (et le retirer de Budget). */
  onUnreceive?: () => Promise<void>;
  onDelete?: () => Promise<void>;
}

/** Un paiement attendu : son nom, son montant, sa date. */
export function PaymentEditor({ payment, onClose, onSave, onUnreceive, onDelete }: Props) {
  const [label, setLabel] = useState(payment?.label ?? '');
  const [amount, setAmount] = useState(centsToInput(payment?.amountCents ?? null));
  const [expectedDay, setExpectedDay] = useState(payment?.expectedDay ?? '');
  const { saving, error, setError, run } = useSaving();

  function submit() {
    const amountCents = parseEuros(amount);
    const problem = validatePayment({ label, amountCents });
    if (problem) return setError(problem);
    void run(() => onSave({ label: label.trim(), amountCents: amountCents!, expectedDay: expectedDay || null }));
  }

  return (
    <Modal
      title={payment ? 'Modifier le paiement' : 'Nouveau paiement'}
      onClose={onClose}
      footer={
        <>
          {payment && onDelete && (
            <button
              className="btn btn-ghost btn-sm btn-danger"
              disabled={saving}
              onClick={() => window.confirm(`Supprimer le paiement « ${payment.label} » ?`) && void run(onDelete)}
            >
              Supprimer
            </button>
          )}
          {payment?.receivedDay && onUnreceive && (
            <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => void run(onUnreceive)}>
              Pas encore reçu
            </button>
          )}
          <span className="projets-spacer" />
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {payment ? 'Enregistrer' : 'Ajouter'}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="projets-pay-label">Nom</label>
        <input id="projets-pay-label" value={label} placeholder="Acompte, Solde, Échéance 2…" onChange={(e) => setLabel(e.target.value)} autoFocus />
      </div>
      <div className="projets-field-row">
        <div className="field">
          <label htmlFor="projets-pay-amount">Montant (€)</label>
          <input id="projets-pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="projets-pay-expected">Attendu le</label>
          <input id="projets-pay-expected" type="date" value={expectedDay} onChange={(e) => setExpectedDay(e.target.value)} />
        </div>
      </div>
      {payment?.receivedDay && <p className="projets-hint">Ce paiement est reçu. « Pas encore reçu » le remet en attente{onUnreceive ? ' et le retire de Budget' : ''}.</p>}
      {error && <div className="notice error">{error}</div>}
    </Modal>
  );
}
