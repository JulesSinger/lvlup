import { useState } from 'react';
import { TRADE_LABELS } from '../lib/status';
import { CLIENT_TRADES, type Client, type ClientInput, type ClientTrade } from '../lib/types';
import { validateClient } from '../lib/validation';
import { Modal } from './Modal';
import { useSaving } from './useSaving';

interface Props {
  /** `null` : un nouveau client */
  client: Client | null;
  /** Ses projets : un client qui en a ne se supprime pas, il s'archive. */
  projectCount: number;
  onClose: () => void;
  onSave: (input: ClientInput) => Promise<void>;
  onArchive?: (archived: boolean) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function ClientEditor({ client, projectCount, onClose, onSave, onArchive, onDelete }: Props) {
  const [input, setInput] = useState<ClientInput>({
    name: client?.name ?? '',
    trade: client?.trade ?? 'commerce',
    contactName: client?.contactName ?? '',
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    address: client?.address ?? '',
    note: client?.note ?? '',
  });
  const { saving, error, setError, run } = useSaving();
  const set = (patch: Partial<ClientInput>) => setInput((i) => ({ ...i, ...patch }));

  function submit() {
    const problem = validateClient(input);
    if (problem) return setError(problem);
    void run(() => onSave({ ...input, name: input.name.trim(), email: input.email?.trim() }));
  }

  return (
    <Modal
      title={client ? 'Modifier le client' : 'Nouveau client'}
      onClose={onClose}
      footer={
        <>
          {client && onDelete && projectCount === 0 && (
            <button
              className="btn btn-ghost btn-sm btn-danger"
              disabled={saving}
              onClick={() => window.confirm(`Supprimer le client « ${client.name} » ?`) && void run(onDelete)}
            >
              Supprimer
            </button>
          )}
          {client && onArchive && projectCount > 0 && (
            <button className="btn btn-ghost btn-sm" disabled={saving} onClick={() => void run(() => onArchive(!client.archived))}>
              {client.archived ? 'Désarchiver' : 'Archiver'}
            </button>
          )}
          <span className="projets-spacer" />
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {client ? 'Enregistrer' : 'Créer'}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="projets-client-name">Nom du commerce</label>
        <input id="projets-client-name" value={input.name} placeholder="Fleurs de Lou" onChange={(e) => set({ name: e.target.value })} autoFocus />
      </div>
      <div className="field">
        <label htmlFor="projets-client-trade">Métier</label>
        <select id="projets-client-trade" value={input.trade} onChange={(e) => set({ trade: e.target.value as ClientTrade })}>
          {CLIENT_TRADES.map((t) => (
            <option key={t} value={t}>
              {TRADE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="projets-field-row">
        <div className="field">
          <label htmlFor="projets-client-contact">Contact</label>
          <input id="projets-client-contact" value={input.contactName} placeholder="Lou Martin" onChange={(e) => set({ contactName: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="projets-client-phone">Téléphone</label>
          <input id="projets-client-phone" type="tel" value={input.phone} onChange={(e) => set({ phone: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="projets-client-email">E-mail</label>
        <input id="projets-client-email" type="email" value={input.email} onChange={(e) => set({ email: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="projets-client-address">Adresse</label>
        <input id="projets-client-address" value={input.address} onChange={(e) => set({ address: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="projets-client-note">Note</label>
        <textarea id="projets-client-note" rows={3} value={input.note} onChange={(e) => set({ note: e.target.value })} />
      </div>
      {client && projectCount > 0 && <p className="projets-hint">Ce client a des projets : il s’archive au lieu de se supprimer.</p>}
      {error && <div className="notice error">{error}</div>}
    </Modal>
  );
}
