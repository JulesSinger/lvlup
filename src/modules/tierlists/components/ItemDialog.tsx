import { useState } from 'react';
import { ITEM_LABEL_MAX, type Tier, type TierItem } from '../lib/types';
import { validateItem } from '../lib/validation';
import { ItemImage } from './ItemImage';
import { Modal } from './Modal';

/**
 * Un élément : son nom, et « Envoyer à » — le classer sans glisser, pour un
 * clavier, un lecteur d'écran, ou un doigt qui préfère toucher.
 */
export function ItemDialog({ item, tiers, onRename, onSend, onDelete, onClose }: {
  item: TierItem;
  tiers: Tier[];
  onRename: (label: string) => Promise<void>;
  onSend: (tierId: string | null) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(item.label);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Ça n’a pas marché.');
      setBusy(false);
    }
  };

  const save = () => {
    const refusal = validateItem({ label }, Boolean(item.image));
    if (refusal) return setProblem(refusal);
    if (label.trim() === item.label) return onClose();
    void run(() => onRename(label.trim()));
  };

  return (
    <Modal
      title={item.label || 'Image'}
      onClose={onClose}
      footer={
        <>
          <button
            className="btn btn-ghost tierlists-foot-left"
            disabled={busy}
            onClick={() => window.confirm(`Supprimer « ${item.label || 'cette image'} » ?`) && void run(onDelete)}
          >
            Supprimer
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            Enregistrer
          </button>
        </>
      }
    >
      {item.image && <ItemImage item={item} size="full" className="tierlists-item-full" />}
      <div className="field">
        <label htmlFor="tierlists-item-label">{item.image ? 'Nom (facultatif)' : 'Texte'}</label>
        <input
          id="tierlists-item-label"
          value={label}
          maxLength={ITEM_LABEL_MAX}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </div>
      <div className="field">
        <label>Envoyer à</label>
        <div className="tierlists-send" role="group" aria-label="Envoyer à">
          {tiers.map((t) => (
            <button
              key={t.id}
              className={`tierlists-send-tier${item.tierId === t.id ? ' is-on' : ''}`}
              style={{ ['--tierlists-color' as string]: `var(--${t.color})` }}
              disabled={busy}
              aria-pressed={item.tierId === t.id}
              onClick={() => void run(() => onSend(t.id))}
            >
              {t.label}
            </button>
          ))}
          <button
            className={`tierlists-send-tier tierlists-send-reserve${item.tierId === null ? ' is-on' : ''}`}
            disabled={busy}
            aria-pressed={item.tierId === null}
            onClick={() => void run(() => onSend(null))}
          >
            À classer
          </button>
        </div>
      </div>
      {problem && <p className="tierlists-error">{problem}</p>}
    </Modal>
  );
}
