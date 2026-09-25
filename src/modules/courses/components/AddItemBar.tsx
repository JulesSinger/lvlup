import { useState } from 'react';
import { findItemByName, suggestItems } from '../lib/catalog';
import { recurrenceLabel } from '../lib/trip';
import type { Item, ListEntry } from '../lib/types';

interface Props {
  items: Item[];
  entries: ListEntry[];
  nextTrip: number;
  /** `existing` : l'article du catalogue qui porte ce nom, s'il y en a un. Rejette en cas d'échec. */
  onAdd: (name: string, existing: Item | null) => Promise<void>;
}

/**
 * Ajouter à la liste : taper un nom puis Entrée, ou choisir un article déjà
 * connu. Un nom déjà au catalogue reprend l'article existant — jamais de
 * doublon, c'est lui qui porte la récurrence et l'historique des prix.
 *
 * Tant que le champ a le focus sans rien de tapé, les habituels dus sont
 * proposés en premier : le raccourci pour refaire la liste de la semaine.
 * En cas d'échec, le texte tapé reste dans le champ.
 */
export function AddItemBar({ items, entries, nextTrip, onAdd }: Props) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const suggestions = open ? suggestItems(items, entries, text, nextTrip) : [];

  async function add(name: string, existing: Item | null) {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onAdd(trimmed, existing ?? findItemByName(items, trimmed));
      setText('');
      // Refermer les suggestions : restées ouvertes, elles recouvraient
      // l'article tout juste ajouté, qu'on ne pouvait plus cocher. Elles
      // reviennent dès qu'on tape à nouveau.
      setOpen(false);
    } catch {
      // L'erreur est affichée par l'écran ; le texte reste pour réessayer.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="courses-add">
      <div className="courses-add-row">
        <input
          type="text"
          className="courses-add-input"
          aria-label="Ajouter un article"
          placeholder="Ajouter un article : lait, pommes, lessive…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add(text, null);
            if (e.key === 'Escape') setOpen(false);
          }}
          autoComplete="off"
        />
        <button type="button" className="btn btn-primary" onClick={() => void add(text, null)} disabled={busy || !text.trim()}>
          Ajouter
        </button>
      </div>
      {suggestions.length > 0 && (
        <ul className="courses-suggestions" role="listbox" aria-label="Articles déjà connus">
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="courses-suggestion"
                // `mousedown` plutôt que `click` : le champ perd le focus au
                // clic, ce qui fermerait la liste avant que le clic arrive.
                onMouseDown={(e) => {
                  e.preventDefault();
                  void add(item.name, item);
                }}
              >
                <span className="courses-suggestion-name">{item.name}</span>
                <span className="courses-suggestion-detail">{recurrenceLabel(item.recurrence)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
