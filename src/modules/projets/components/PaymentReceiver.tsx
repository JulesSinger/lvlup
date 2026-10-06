import { useState } from 'react';
import { formatEuros } from '../lib/money';
import { PAYMENT_METHOD_LABELS } from '../lib/payments';
import { PAYMENT_METHODS, type Payment, type PaymentMethod } from '../lib/types';
import { Modal } from './Modal';
import { useSaving } from './useSaving';

export interface Receipt {
  receivedDay: string;
  method: PaymentMethod;
  invoiceRef: string;
  sendToBudget: boolean;
}

interface Props {
  payment: Payment;
  today: string;
  /** Budget est-il là pour recevoir l'entrée ? Sinon la case n'apparaît pas. */
  canSendToBudget: boolean;
  onClose: () => void;
  onReceive: (receipt: Receipt) => Promise<void>;
}

/**
 * Noter un paiement reçu : quand, comment, sur quelle facture — les colonnes
 * du livre des recettes — et, coché d'office, l'ajouter à Budget.
 */
export function PaymentReceiver({ payment, today, canSendToBudget, onClose, onReceive }: Props) {
  const [receivedDay, setReceivedDay] = useState(today);
  const [method, setMethod] = useState<PaymentMethod>('virement');
  const [invoiceRef, setInvoiceRef] = useState(payment.invoiceRef);
  const [sendToBudget, setSendToBudget] = useState(canSendToBudget);
  const { saving, error, setError, run } = useSaving();

  function submit() {
    if (!receivedDay) return setError('Indique le jour de réception.');
    if (invoiceRef.trim().length > 60) return setError('La référence de facture est trop longue (60 caractères au plus).');
    void run(() => onReceive({ receivedDay, method, invoiceRef: invoiceRef.trim(), sendToBudget: canSendToBudget && sendToBudget }));
  }

  return (
    <Modal
      title="Paiement reçu"
      onClose={onClose}
      footer={
        <>
          <span className="projets-spacer" />
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            C’est reçu
          </button>
        </>
      }
    >
      <p className="projets-receive-what">
        <b>{payment.label}</b> · {formatEuros(payment.amountCents)}
      </p>
      <div className="projets-field-row">
        <div className="field">
          <label htmlFor="projets-receive-day">Reçu le</label>
          <input id="projets-receive-day" type="date" value={receivedDay} onChange={(e) => setReceivedDay(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="projets-receive-method">Mode de règlement</label>
          <select id="projets-receive-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="projets-receive-invoice">Référence de la facture</label>
        <input id="projets-receive-invoice" value={invoiceRef} placeholder="F-2026-004" onChange={(e) => setInvoiceRef(e.target.value)} />
      </div>
      {canSendToBudget && (
        <label className="projets-check">
          <input type="checkbox" checked={sendToBudget} onChange={(e) => setSendToBudget(e.target.checked)} />
          <span>Ajouter à Budget, comme une entrée « Revenus freelance »</span>
        </label>
      )}
      {error && <div className="notice error">{error}</div>}
    </Modal>
  );
}
