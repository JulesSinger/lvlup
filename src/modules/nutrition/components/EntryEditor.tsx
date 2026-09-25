import { useEffect, useState } from 'react';
import { rescaleEntry } from '../lib/journal';
import { formatDg } from '../lib/macros';
import type { Entry } from '../lib/types';

interface Props {
  entry: Entry;
  onCancel: () => void;
  onSave: (grams: number) => Promise<void>;
  onDelete: () => Promise<void>;
}

/**
 * Corriger la quantité d'une entrée, ou la retirer. Les valeurs sont remises
 * à l'échelle depuis celles figées à la saisie (`rescaleEntry`), jamais
 * relues sur l'aliment, qui a pu changer depuis.
 */
export function EntryEditor({ entry, onCancel, onSave, onDelete }: Props) {
  const [grams, setGrams] = useState(String(entry.grams));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const value = Number(grams);
  const valid = Number.isInteger(value) && value >= 1 && value <= 10000;
  const preview = valid ? rescaleEntry(entry, value) : null;

  async function run(action: () => Promise<void>) {
    setSaving(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  function submit() {
    if (!valid) {
      setError('Indique une quantité en grammes, entre 1 et 10 000.');
      return;
    }
    void run(() => onSave(value));
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="modal nutrition-entry-editor"
        role="dialog"
        aria-modal="true"
        aria-label="Modifier la quantité"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">{entry.label}</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label htmlFor="nutrition-entry-grams">Quantité (g)</label>
            <input
              id="nutrition-entry-grams"
              type="number"
              inputMode="numeric"
              min={1}
              max={10000}
              step={1}
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              autoFocus
            />
          </div>
          {preview && (
            <p className="nutrition-quantity-preview">
              <b>{preview.kcal} kcal</b> · protéines {formatDg(preview.proteinDg)} · glucides{' '}
              {formatDg(preview.carbsDg)} · lipides {formatDg(preview.fatDg)}
            </p>
          )}
          {error && <div className="notice error">{error}</div>}
        </div>

        <div className="modal-foot">
          <button
            className="btn btn-ghost btn-danger nutrition-entry-delete"
            onClick={() => void run(onDelete)}
            disabled={saving}
          >
            Retirer
          </button>
          <button className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving || !valid}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
