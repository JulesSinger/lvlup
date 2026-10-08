import { useMemo, useState } from 'react';
import type { ShoppingRequest } from '../../../core/lib/services';
import { ingredientKey } from '../lib/ingredients';
import type { ShoppingLine } from '../lib/menu';
import { Modal } from './Modal';

/**
 * La liste à relire avant d'envoyer à Courses (docs/etude-recettes.md §6.1,
 * §18) — décision de Jules : jamais automatique, toujours un geste voulu.
 * Les ingrédients « toujours là » sont décochés d'office, et chacun peut le
 * devenir (ou ne plus l'être) d'un toucher, pour les fois suivantes.
 */
export function ShoppingDialog({ title, lines, pantry, onPantry, onSend, onClose }: {
  title: string;
  lines: ShoppingLine[];
  pantry: string[];
  onPantry: (pantry: string[]) => Promise<void>;
  onSend: (requests: ShoppingRequest[]) => Promise<void>;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(lines.filter((l) => !l.pantry).map((l) => l.key)));
  const [quantities, setQuantities] = useState<Record<string, string>>(() => Object.fromEntries(lines.map((l) => [l.key, l.quantity])));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const pantryKeys = useMemo(() => new Set(pantry.map(ingredientKey)), [pantry]);

  const toggle = (key: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  async function togglePantry(line: ShoppingLine) {
    const always = pantryKeys.has(line.key);
    const next = always ? pantry.filter((p) => ingredientKey(p) !== line.key) : [...pantry, line.name.toLowerCase()];
    await onPantry(next);
    // « Toujours là » : on ne l'achète pas cette fois-ci non plus.
    setChecked((prev) => {
      const s = new Set(prev);
      if (always) s.add(line.key);
      else s.delete(line.key);
      return s;
    });
  }

  async function send() {
    const chosen = lines.filter((l) => checked.has(l.key));
    setSending(true);
    setError('');
    try {
      await onSend(chosen.map((l) => ({ name: l.name, quantity: (quantities[l.key] ?? '').trim(), note: l.sources.join(', ') })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'L’envoi à Courses n’a pas abouti.');
      setSending(false);
    }
  }

  return (
    <Modal
      title={`Courses — ${title}`}
      onClose={onClose}
      className="recettes-shopping"
      footer={
        <>
          <span className="recettes-spacer" />
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={() => void send()} disabled={sending || checked.size === 0}>
            Ajouter {checked.size} article{checked.size > 1 ? 's' : ''} aux courses
          </button>
        </>
      }
    >
      {lines.length === 0 ? (
        <p className="recettes-hint">Aucun ingrédient à acheter.</p>
      ) : (
        <>
          <p className="recettes-hint recettes-shopping-intro">Décoche ce que tu as déjà. Les quantités se corrigent avant d’envoyer.</p>
          <ul className="recettes-shopping-list">
            {lines.map((l) => {
              const on = checked.has(l.key);
              const always = pantryKeys.has(l.key);
              return (
                <li key={l.key} className={`recettes-shopping-line${on ? '' : ' off'}`}>
                  <label className="recettes-shopping-check">
                    <input type="checkbox" checked={on} onChange={() => toggle(l.key)} />
                    <span className="recettes-shopping-name">{l.name}</span>
                  </label>
                  <input
                    className="recettes-shopping-qty"
                    aria-label={`Quantité de ${l.name}`}
                    value={quantities[l.key] ?? ''}
                    maxLength={30}
                    placeholder="—"
                    onChange={(e) => setQuantities((q) => ({ ...q, [l.key]: e.target.value }))}
                  />
                  <button
                    type="button"
                    className={`recettes-pantry${always ? ' on' : ''}`}
                    aria-pressed={always}
                    title={always ? 'Toujours chez moi — toucher pour l’enlever' : 'Je l’ai toujours chez moi'}
                    onClick={() => void togglePantry(l)}
                  >
                    {always ? 'toujours là' : '+ toujours là'}
                  </button>
                  {l.sources.length > 1 && <span className="recettes-shopping-sources">{l.sources.join(', ')}</span>}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {error && (
        <p className="recettes-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
