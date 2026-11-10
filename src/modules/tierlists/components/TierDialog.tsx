import { useState } from 'react';
import { TIER_COLORS, TIER_LABEL_MAX, type Tier, type TierColor } from '../lib/types';
import { validateTier } from '../lib/validation';
import { Modal } from './Modal';

const COLOR_NAMES: Record<TierColor, string> = {
  red: 'Rouge',
  orange: 'Orange',
  coral: 'Corail',
  peach: 'Pêche',
  yellow: 'Jaune',
  lime: 'Citron vert',
  green: 'Vert',
  teal: 'Turquoise',
  sky: 'Ciel',
  blue: 'Bleu',
  indigo: 'Indigo',
  violet: 'Violet',
  lavender: 'Lavande',
  pink: 'Rose',
  gray: 'Gris',
};

/** Une rangée : son nom, sa couleur, sa place ; la supprimer renvoie ses éléments à classer. */
export function TierDialog({ tier, isFirst, isLast, count, onSave, onMove, onDelete, onClose }: {
  /** Sans `id` : une rangée à ajouter, avec la couleur proposée. */
  tier: Tier | { label: string; color: TierColor; id?: undefined };
  isFirst: boolean;
  isLast: boolean;
  count: number;
  onSave: (patch: { label: string; color: TierColor }) => Promise<void>;
  onMove?: (direction: -1 | 1) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(tier.label);
  const [color, setColor] = useState<TierColor>(tier.color);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const creating = !tier.id;

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
    const refusal = validateTier({ label, color });
    if (refusal) return setProblem(refusal);
    void run(() => onSave({ label: label.trim(), color }));
  };

  return (
    <Modal
      title={creating ? 'Nouvelle rangée' : `La rangée ${tier.label}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {creating ? 'Ajouter' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="tierlists-tier-preview" style={{ ['--tierlists-color' as string]: `var(--${color})` }}>
        {label.trim() || '…'}
      </div>
      <div className="field">
        <label htmlFor="tierlists-tier-label">Nom</label>
        <input
          id="tierlists-tier-label"
          value={label}
          maxLength={TIER_LABEL_MAX}
          autoFocus
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </div>
      <div className="field">
        <label>Couleur</label>
        <div className="tierlists-swatches" role="radiogroup" aria-label="Couleur">
          {TIER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={c === color}
              aria-label={COLOR_NAMES[c]}
              title={COLOR_NAMES[c]}
              className={`tierlists-swatch${c === color ? ' is-on' : ''}`}
              style={{ ['--tierlists-color' as string]: `var(--${c})` }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
      {problem && <p className="tierlists-error">{problem}</p>}
      {!creating && (onMove || onDelete) && (
        <div className="tierlists-danger-zone">
          {onMove && (
            <>
              <button className="btn btn-sm" disabled={busy || isFirst} onClick={() => void run(() => onMove(-1))}>
                ↑ Monter
              </button>
              <button className="btn btn-sm" disabled={busy || isLast} onClick={() => void run(() => onMove(1))}>
                ↓ Descendre
              </button>
            </>
          )}
          {onDelete && (
            <button
              className="btn btn-sm btn-danger"
              disabled={busy}
              onClick={() =>
                (count === 0 || window.confirm(`Supprimer la rangée ${tier.label} ? Ses ${count} élément${count > 1 ? 's' : ''} retourne${count > 1 ? 'nt' : ''} à classer.`)) &&
                void run(onDelete)
              }
            >
              Supprimer la rangée
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
